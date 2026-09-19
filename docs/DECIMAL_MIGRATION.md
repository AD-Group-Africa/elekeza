# Elekeza — DECIMAL Migration Spec
**Status:** Pre-production — no live financial data exists yet  
**Target:** Execute as Flyway V13 before first real M-Pesa transaction  
**Author:** Alvin / AD Group Africa  

---

## Why

All money columns in the current schema use `DOUBLE PRECISION`.
Floating point arithmetic produces rounding errors that are unacceptable
in a financial system. A parent's balance, a fee charge, or a receipt
total must be exact to the cent.

`DECIMAL(19,4)` stores values exactly. 19 total digits, 4 decimal places.
This matches the M-Pesa precision model (amounts to 2dp, stored to 4dp
for intermediate calculations) and gives headroom for large school-level
aggregates.

---

## Affected Tables and Columns

Identified from Flyway migrations V1–V12:

### `fee_structures`
| Column | Current | Target |
|---|---|---|
| `amount` | `DOUBLE PRECISION` | `DECIMAL(19,4)` |

### `fee_items`
| Column | Current | Target |
|---|---|---|
| `amount` | `DOUBLE PRECISION` | `DECIMAL(19,4)` |

### `learner_charges`
| Column | Current | Target |
|---|---|---|
| `amount` | `DOUBLE PRECISION` | `DECIMAL(19,4)` |
| `amount_paid` | `DOUBLE PRECISION` | `DECIMAL(19,4)` |
| `balance` | `DOUBLE PRECISION` | `DECIMAL(19,4)` |

### `payments`
| Column | Current | Target |
|---|---|---|
| `amount` | `DOUBLE PRECISION` | `DECIMAL(19,4)` |
| `mpesa_amount` | `DOUBLE PRECISION` | `DECIMAL(19,4)` |

### `allocations`
| Column | Current | Target |
|---|---|---|
| `amount_allocated` | `DOUBLE PRECISION` | `DECIMAL(19,4)` |

### `receipts`
| Column | Current | Target |
|---|---|---|
| `total_amount` | `DOUBLE PRECISION` | `DECIMAL(19,4)` |
| `amount_paid` | `DOUBLE PRECISION` | `DECIMAL(19,4)` |
| `balance_after` | `DOUBLE PRECISION` | `DECIMAL(19,4)` |

---

## Flyway Migration Script — V13

File: `src/main/resources/db/migration/V13__decimal_money_columns.sql`

```sql
-- V13: Convert all money columns from DOUBLE PRECISION to DECIMAL(19,4)
-- Safe to run: no production data exists at time of execution.
-- All existing values (from test/seed data only) are preserved by PostgreSQL
-- automatic cast from DOUBLE PRECISION to DECIMAL(19,4).

ALTER TABLE fee_structures
    ALTER COLUMN amount TYPE DECIMAL(19,4) USING amount::DECIMAL(19,4);

ALTER TABLE fee_items
    ALTER COLUMN amount TYPE DECIMAL(19,4) USING amount::DECIMAL(19,4);

ALTER TABLE learner_charges
    ALTER COLUMN amount       TYPE DECIMAL(19,4) USING amount::DECIMAL(19,4),
    ALTER COLUMN amount_paid  TYPE DECIMAL(19,4) USING amount_paid::DECIMAL(19,4),
    ALTER COLUMN balance      TYPE DECIMAL(19,4) USING balance::DECIMAL(19,4);

ALTER TABLE payments
    ALTER COLUMN amount        TYPE DECIMAL(19,4) USING amount::DECIMAL(19,4),
    ALTER COLUMN mpesa_amount  TYPE DECIMAL(19,4) USING mpesa_amount::DECIMAL(19,4);

ALTER TABLE allocations
    ALTER COLUMN amount_allocated TYPE DECIMAL(19,4) USING amount_allocated::DECIMAL(19,4);

ALTER TABLE receipts
    ALTER COLUMN total_amount   TYPE DECIMAL(19,4) USING total_amount::DECIMAL(19,4),
    ALTER COLUMN amount_paid    TYPE DECIMAL(19,4) USING amount_paid::DECIMAL(19,4),
    ALTER COLUMN balance_after  TYPE DECIMAL(19,4) USING balance_after::DECIMAL(19,4);
```

---

## Kotlin Entity Changes

Every entity field that maps to a money column changes from `Double` to
`BigDecimal`. `BigDecimal` is Java/Kotlin's exact decimal type.

### Pattern — before and after

```kotlin
// Before
var amount: Double = 0.0

// After
var amount: BigDecimal = BigDecimal.ZERO
```

### Entities to update

`FeeStructure` — `amount`  
`FeeItem` — `amount`  
`LearnerCharge` — `amount`, `amountPaid`, `balance`  
`Payment` — `amount`, `mpesaAmount`  
`Allocation` — `amountAllocated`  
`Receipt` — `totalAmount`, `amountPaid`, `balanceAfter`  

### JPA column annotation to add on each field

```kotlin
@Column(precision = 19, scale = 4)
var amount: BigDecimal = BigDecimal.ZERO
```

---

## Rounding Rule

One rounding rule applies everywhere in the system with no exceptions:

**`RoundingMode.HALF_UP`, scale 4 for storage, scale 2 for display.**

```kotlin
// Storage — 4 decimal places
amount.setScale(4, RoundingMode.HALF_UP)

// Display to guardian or finance officer — 2 decimal places
amount.setScale(2, RoundingMode.HALF_UP).toPlainString()
```

Never use `Double.toFloat()`, `toDouble()`, or any floating point
intermediate in a money calculation after this migration.

---

## Calculation Rules

Every money calculation in service layer code follows these rules:

```kotlin
// Fee balance calculation
val balance = charge.amount
    .subtract(charge.amountPaid)
    .setScale(4, RoundingMode.HALF_UP)

// Receipt total = sum of allocations
val total = allocations
    .map { it.amountAllocated }
    .fold(BigDecimal.ZERO, BigDecimal::add)
    .setScale(4, RoundingMode.HALF_UP)

// M-Pesa amount comparison — always compare BigDecimal with compareTo, not ==
if (payment.mpesaAmount.compareTo(payment.amount) == 0) { ... }
```

---

## DTO and Response Changes

Any DTO that carries money to the API response changes its field type
from `Double` to `BigDecimal`. Spring's Jackson serialiser renders
`BigDecimal` as a plain decimal number (`150.00`) with no scientific
notation — no additional configuration needed.

```kotlin
// DTO — before
data class FeeBalanceResponse(val balance: Double)

// DTO — after
data class FeeBalanceResponse(val balance: BigDecimal)
```

---

## Test Changes

All existing finance tests that use `Double` literals for money
assertions change to `BigDecimal` comparisons.

```kotlin
// Before
assertEquals(150.0, charge.amount)

// After
assertEquals(0, BigDecimal("150.00").compareTo(charge.amount))
// or using AssertJ:
assertThat(charge.amount).isEqualByComparingTo("150.00")
```

Never compare `BigDecimal` values with `==` or `equals()` directly —
`BigDecimal("150.0")` and `BigDecimal("150.00")` are not `equals()` to
each other even though they are numerically identical. Always use
`compareTo() == 0` or AssertJ's `isEqualByComparingTo()`.

---

## M-Pesa Specific Notes

M-Pesa Daraja sends amounts as integers (in cents) or as decimal strings
depending on the API version. The callback handler must parse the incoming
amount to `BigDecimal` before storing — never cast through `Double`.

```kotlin
// Safe M-Pesa amount parse
val mpesaAmount = BigDecimal(callbackData.amount.toString())
    .setScale(4, RoundingMode.HALF_UP)
```

---

## Migration Safety

This migration is safe for the following reasons:

- No production database exists yet. The pilot is the first real deployment.
- PostgreSQL's `USING` clause in `ALTER COLUMN` casts existing values
  automatically. Any test or seed data is preserved exactly.
- `DECIMAL(19,4)` can represent any value that `DOUBLE PRECISION` could
  represent in the range of school fees (KES 0 to ~KES 999,999,999,999,999)
  with no loss of information.
- The migration is a single Flyway file. It either completes fully or
  rolls back on error. No partial state is possible.
- The migration must run before the first real M-Pesa callback is processed.
  The recommended sequence is: deploy V13 → verify schema → enable Daraja
  credentials → go live.

---

## Execution Checklist

- [ ] Add `V13__decimal_money_columns.sql` to the migrations folder
- [ ] Update all 7 entities listed above — change `Double` to `BigDecimal`
- [ ] Add `@Column(precision = 19, scale = 4)` to each money field
- [ ] Update all money DTOs and response objects
- [ ] Update all finance service calculations to use `BigDecimal` arithmetic
- [ ] Update all finance tests to use `compareTo` assertions
- [ ] Update M-Pesa callback amount parser
- [ ] Run the full 220-test backend suite — all must pass
- [ ] Run a manual end-to-end: create fee → charge learner → record payment → verify receipt total matches
- [ ] Deploy V13 to staging before production
- [ ] Confirm Flyway checksum passes on staging
- [ ] Only then enable production Daraja credentials