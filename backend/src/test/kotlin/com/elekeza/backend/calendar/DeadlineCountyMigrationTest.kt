package com.elekeza.backend.calendar

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.sql.Connection
import java.sql.DriverManager

/**
 * Executes `V20__deadline_county_scope.sql` against a real database engine.
 *
 * The application's test profile runs with Flyway disabled, so the rest of the
 * suite creates `county_code` through Hibernate `ddl-auto` and never actually
 * runs V20. That leaves the migration itself unverified. This test closes that
 * gap without asking Flyway to replay V1–V19 on H2 (several of those use
 * PostgreSQL-only constructs).
 *
 * **Scope of the guarantee:** the statements are validated against H2 in
 * PostgreSQL compatibility mode, which is the only engine available in this
 * environment. PostgreSQL 16 itself is **not** verified here — see the report.
 */
class DeadlineCountyMigrationTest {

    private fun connection(): Connection =
        DriverManager.getConnection("jdbc:h2:mem:v20check;MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "")

    private fun migrationStatements(): List<String> {
        val sql = javaClass.classLoader.getResource("db/migration/V20__deadline_county_scope.sql")
            ?.readText() ?: error("V20 migration not found on the classpath")
        val withoutComments = sql.lineSequence()
            .map { line -> line.substringBefore("--").trimEnd() }
            .filter { it.isNotBlank() }
            .joinToString("\n")
        return withoutComments.split(";").map { it.trim() }.filter { it.isNotEmpty() }
    }

    private fun columnExists(conn: Connection, table: String, column: String): Boolean =
        conn.metaData.getColumns(null, null, table.uppercase(), column.uppercase()).use { rs ->
            rs.next()
        }

    @Test
    @DisplayName("V20 adds a nullable county_code column and its index to deadlines")
    fun migrationApplies() {
        connection().use { conn ->
            conn.createStatement().use { st ->
                // Minimal stand-in for the real table: V20 only touches county_code
                // and creates an index, so the rest of the schema is irrelevant here.
                st.execute(
                    """
                    CREATE TABLE deadlines (
                        id BIGINT PRIMARY KEY,
                        scope VARCHAR(20) NOT NULL DEFAULT 'INSTITUTION',
                        institution_id BIGINT,
                        user_id BIGINT,
                        title VARCHAR(255) NOT NULL
                    )
                    """.trimIndent()
                )
            }

            val statements = migrationStatements()
            assertTrue(statements.size >= 2, "expected at least the ALTER and the index, got: $statements")

            conn.createStatement().use { st ->
                statements.forEach { st.execute(it) }
            }

            assertTrue(columnExists(conn, "deadlines", "county_code"), "county_code column was not created")

            // Nullable: existing rows are untouched by design (no backfill).
            conn.createStatement().use { st ->
                st.execute("INSERT INTO deadlines (id, title) VALUES (1, 'legacy regional')")
                st.executeQuery("SELECT county_code FROM deadlines WHERE id = 1").use { rs ->
                    assertTrue(rs.next())
                    assertEquals(null, rs.getString(1), "existing rows must keep a NULL county, never a guessed one")
                }
            }

            // The lookup index exists.
            conn.metaData.getIndexInfo(null, null, "DEADLINES", false, false).use { rs ->
                var found = false
                while (rs.next()) {
                    if (rs.getString("INDEX_NAME")?.contains("COUNTY", ignoreCase = true) == true) found = true
                }
                assertTrue(found, "expected an index on county_code")
            }
        }
    }
}
