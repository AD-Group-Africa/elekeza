package com.elekeza.backend.config.seed

import com.elekeza.backend.auth.*
import com.elekeza.backend.content.*
import com.elekeza.backend.institution.GuardianLink
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.institution.Institution
import com.elekeza.backend.institution.InstitutionRepository
import com.elekeza.backend.learner.*
import com.elekeza.backend.notification.Notification
import com.elekeza.backend.notification.NotificationRepository
import com.elekeza.backend.quiz.*
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.transaction.Transactional
import org.slf4j.LoggerFactory
import org.springframework.boot.CommandLineRunner
import org.springframework.context.annotation.Profile
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Component
import java.time.Instant
import java.time.LocalDateTime

/**
 * Showcase / demo-population seed (dev profile only, opt-in via
 * SHOWCASE_SEED=1). Gives the product a populated, alive feel for demos:
 * a platform ADMIN, 7 teachers, 30 learners, 15 guardians, 6 subjects with
 * 13 structured lessons (plus the original water-cycle demo lesson), one
 * quiz per lesson, realistic assignments, quiz history and notifications
 * spread over the past two weeks.
 *
 * It is intentionally separate from [DataInitializer]: the base demo accounts
 * stay untouched, and this seeder is a no-op unless the operator opts in.
 * Every write is guarded so repeated boots are safe.
 */
@Component
@Profile("dev")
@Order(Ordered.LOWEST_PRECEDENCE)
class ShowcaseDataInitializer(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val learnerProfileRepo: LearnerProfileRepository,
    private val contentRepo: ContentRepository,
    private val quizRepo: QuizRepository,
    private val questionRepo: QuizQuestionRepository,
    private val attemptRepo: QuizAttemptRepository,
    private val progressRepo: LessonProgressRepository,
    private val guardianLinkRepo: GuardianLinkRepository,
    private val notificationRepo: NotificationRepository,
    private val institutionRepo: InstitutionRepository,
    private val objectMapper: ObjectMapper
) : CommandLineRunner {

    private val log = LoggerFactory.getLogger(ShowcaseDataInitializer::class.java)

    @Transactional
    override fun run(vararg args: String?) {
        if (System.getenv("SHOWCASE_SEED") != "1") return
        if (contentRepo.findAll().any { it.title?.startsWith("Mathematics:") == true }) {
            log.info("Showcase seed already present — skipping.")
            return
        }
        log.info("Seeding showcase data (SHOWCASE_SEED=1)...")

        // V2 seeds institution id=1; reuse it, otherwise create one.
        val school = institutionRepo.findById(1L).orElseGet {
            institutionRepo.save(Institution(name = "Sunrise Inclusive Academy", type = "SCHOOL", county = "Nairobi", country = "Kenya"))
        }
        val instId = school.id

        // ── Platform ADMIN ───────────────────────────────────────────────────
        // Belongs to the school: school-scoped admin views (roster, students-by-grade)
        // read the admin's own institutionId; a null left the admin dashboard empty.
        val admin = createUser("admin@elekeza.app", "admin123", "Grace Njeri", UserRole.ADMIN, instId)

        // ── Teachers (7) ─────────────────────────────────────────────────────
        // Do not assume execution order relative to DataInitializer: create the
        // base teacher account if it does not exist yet.
        val alice = userRepository.findByEmail("teacher@elekeza.app")
            ?: createUser("teacher@elekeza.app", "teacher123", "Alice Mwalimu", UserRole.TEACHER, instId)
        val teachers = listOf(
            alice to "Alice Mwalimu",
            createUser("teacher2@elekeza.app", "teacher123", "Grace Otieno", UserRole.TEACHER, instId) to "Grace Otieno",
            createUser("teacher3@elekeza.app", "teacher123", "Peter Kimani", UserRole.TEACHER, instId) to "Peter Kimani",
            createUser("teacher4@elekeza.app", "teacher123", "Amina Hassan", UserRole.TEACHER, instId) to "Amina Hassan",
            createUser("teacher5@elekeza.app", "teacher123", "David Mwangi", UserRole.TEACHER, instId) to "David Mwangi",
            createUser("teacher6@elekeza.app", "teacher123", "Faith Wanjiru", UserRole.TEACHER, instId) to "Faith Wanjiru",
            createUser("teacher7@elekeza.app", "teacher123", "Kevin Ochieng", UserRole.TEACHER, instId) to "Kevin Ochieng"
        )
        teachers.forEach { (t, _) -> if (t.institutionId == null) { t.institutionId = instId; userRepository.save(t) } }

        // ── Learners (30) ────────────────────────────────────────────────────
        val learnerNames = listOf(
            "Juma Ali", "Amani Wanjiku", "Brian Omondi", "Cynthia Njeri", "Daniel Kipchoge",
            "Esther Achieng", "Francis Mwangi", "Grace Adhiambo", "Hassan Yusuf", "Ivy Muthoni",
            "James Kamau", "Khadija Hassan", "Linet Chebet", "Michael Otieno", "Naomi Wairimu",
            "Oscar Kiprotich", "Purity Moraa", "Quinter Auma", "Raymond Njoroge", "Salma Abdi",
            "Titus Karanja", "Umi Baraka", "Victor Ochieng", "Winnie Jepkoech", "Xavier Mwenda",
            "Yvonne Akinyi", "Zedekiah Mutua", "Abigail Nyambura", "Collins Odhiambo", "Diana Wambui"
        )
        val sneCycle = listOf(SneType.DYSLEXIA, SneType.ADHD, SneType.AUTISM, SneType.DYSCALCULIA, SneType.INTELLECTUAL_DISABILITY, SneType.NONE)
        val learners = learnerNames.mapIndexed { i, name ->
            val email = if (i == 0) "student@elekeza.app" else "learner${i + 1}@elekeza.app"
            val user = userRepository.findByEmail(email) ?: createUser(email, "learner123", name, UserRole.STUDENT, instId)
            ensureProfile(user, sneCycle[i % sneCycle.size])
            user
        }

        // ── Guardians (15) ───────────────────────────────────────────────────
        val guardianNames = listOf(
            "Fatima Ali", "Zawadi Ali", "Mary Achieng", "John Kamande", "Lucy Wanjiru",
            "Samuel Otieno", "Rose Chebet", "Peter Mwangi", "Halima Abdi", "George Kiptoo",
            "Agnes Moraa", "Daniel Njoroge", "Esther Wambui", "Josephine Auma", "Brian Kiprop"
        )
        val guardians = guardianNames.mapIndexed { i, name ->
            val email = if (i < 3) listOf("parent@elekeza.app", "sibling@elekeza.app", "caregiver@elekeza.app")[i] else "guardian${i + 1}@elekeza.app"
            userRepository.findByEmail(email) ?: createUser(email, "guardian123", name, UserRole.GUARDIAN, null)
        }
        val relationships = listOf("PARENT", "OLDER_SIBLING", "CAREGIVER", "PARENT", "PARENT", "PARENT", "PARENT", "PARENT", "PARENT", "PARENT", "PARENT", "PARENT", "PARENT", "PARENT", "PARENT")
        guardians.forEachIndexed { i, g ->
            // Juma (learner index 0) already has 3 links from DataInitializer.
            val wardIndexes = when (i) {
                0, 1, 2 -> emptyList()
                else -> {
                    val base = (i * 3) % learners.size
                    listOf(base, (base + 1) % learners.size).distinct()
                }
            }
            wardIndexes.forEach { li ->
                val exists = guardianLinkRepo.findAll().any { it.guardianId == g.id && it.learnerId == learners[li].id }
                if (!exists) guardianLinkRepo.save(GuardianLink(guardianId = g.id, learnerId = learners[li].id, relationship = relationships[i]))
            }
        }

        // ── Lessons: 6 subjects × 2–3 lessons (13 new + original) ───────────
        val grace = teachers[1].first   // Mathematics
        val david = teachers[4].first   // Science
        val peter = teachers[2].first   // English
        val amina = teachers[3].first   // Kiswahili
        val faith = teachers[5].first   // Social Studies
        val kevin = teachers[6].first   // Computer Studies

        val contentIds = mutableListOf<Long>()
        val lessonSpecs = listOf(
            LessonSpec(grace, "Mathematics: Fractions — What is a half?",
                "A fraction shows a part of a whole. If you cut a cake into two equal pieces, each piece is one half. The number on top (1) is the numerator. The number at the bottom (2) is the denominator. A half is written as 1/2. If you cut the cake into four equal pieces, each piece is one quarter, written as 1/4. Two quarters make one half.",
                listOf("What is a fraction?" to "A fraction shows a part of a whole.", "Numerator and denominator" to "The top number counts the parts you have; the bottom number tells how many equal parts the whole is split into.", "Halves and quarters" to "One half is 1/2. One quarter is 1/4. Two quarters equal one half."),
                listOf("Fraction" to "A part of a whole", "Numerator" to "The top number of a fraction", "Denominator" to "The bottom number of a fraction")),
            LessonSpec(grace, "Mathematics: Addition and Subtraction",
                "Addition means putting numbers together. If you have 3 apples and get 2 more, you have 5 apples. We write 3 + 2 = 5. Subtraction means taking away. If you have 5 apples and eat 2, you have 3 left. We write 5 - 2 = 3. Counting on your fingers or using objects helps you add and subtract.",
                listOf("Addition" to "Putting numbers together to find a total.", "Subtraction" to "Taking one number away from another.", "Checking your answer" to "Add again or count objects to make sure your answer is right."),
                listOf("Sum" to "The answer to an addition", "Difference" to "The answer to a subtraction")),
            LessonSpec(grace, "Mathematics: Shapes Around Us",
                "Shapes are everywhere. A circle is round like a ball or a plate. A square has four equal sides. A rectangle has four sides: two long and two short. A triangle has three sides and three corners. Naming shapes helps you describe what you see.",
                listOf("Circle" to "A round shape with no corners.", "Square and rectangle" to "Both have four sides; a square's sides are all equal, a rectangle's are not.", "Triangle" to "A shape with three sides and three corners."),
                listOf("Circle" to "A round shape", "Square" to "Four equal sides", "Triangle" to "Three sides")),
            LessonSpec(david, "Science: Plants and Photosynthesis",
                "Plants make their own food using sunlight. This is called photosynthesis. Leaves catch sunlight with a green substance called chlorophyll. The plant takes in water through its roots and carbon dioxide from the air. Using light energy, it makes glucose (food) and oxygen. We breathe the oxygen plants make.",
                listOf("How plants feed" to "Plants use sunlight, water and air to make food.", "Chlorophyll" to "The green substance in leaves that captures sunlight.", "What plants give us" to "Plants make oxygen, which we need to breathe."),
                listOf("Photosynthesis" to "How plants make food using sunlight", "Chlorophyll" to "The green pigment in leaves", "Glucose" to "The food plants make")),
            LessonSpec(david, "Science: The Human Body — Five Senses",
                "Your body has five senses. You see with your eyes. You hear with your ears. You smell with your nose. You taste with your tongue. You feel with your skin. Your senses help you understand the world and stay safe.",
                listOf("The five senses" to "Sight, hearing, smell, taste and touch.", "Which body part" to "Eyes see, ears hear, nose smells, tongue tastes, skin feels.", "Why senses matter" to "They help you learn and keep you safe."),
                listOf("Senses" to "Ways your body learns about the world", "Sight" to "Using your eyes")),
            LessonSpec(peter, "English: Nouns and Verbs",
                "A noun names a person, place or thing. Examples: teacher, school, book. A verb is an action word. Examples: run, read, write. In the sentence 'The girl reads a book', 'girl' and 'book' are nouns, and 'reads' is the verb. Every sentence needs a verb.",
                listOf("Nouns" to "Words that name people, places or things.", "Verbs" to "Words that show actions.", "Finding them in a sentence" to "Look for the person or thing (noun) and what it does (verb)."),
                listOf("Noun" to "A naming word", "Verb" to "An action word")),
            LessonSpec(peter, "English: Reading a Story",
                "A story has a beginning, a middle and an end. The beginning introduces the characters and where the story happens. The middle tells what happens to them. The end shows how the story finishes. Asking 'What happens next?' helps you follow the story.",
                listOf("Story parts" to "Beginning, middle and end.", "Characters" to "The people or animals in the story.", "Following along" to "Ask what happens next to keep track."),
                listOf("Characters" to "The people in a story", "Setting" to "Where the story happens")),
            LessonSpec(amina, "Kiswahili: Maneno ya Kiswahili",
                "Kiswahili ni lugha ya Kenya. 'Habari' inamaanisha news au salamu. 'Asante' inamaanisha thank you. 'Tafadhali' inamaanisha please. Kujifunza maneno mapya kila siku husaidia kuongea Kiswahili vizuri.",
                listOf("Salamu" to "Habari, mambo, salama — salamu za kawaida.", "Maneno ya adabu" to "Asante (thank you), tafadhali (please), samahani (sorry).", "Kufanya mazoezi" to "Sema maneno mapya mara tatu kila siku."),
                listOf("Salamu" to "Greetings", "Asante" to "Thank you")),
            LessonSpec(amina, "Kiswahili: Kusoma Hadithi",
                "Hadithi ina mwanzo, katikati na mwisho. Mwanzo hutambulisha wahusika. Katikati hueleza kinachotokea. Mwisho huonyesha jinsi hadithi inavyomalizika. Kusoma hadithi husaidia kujifunza maneno mapya.",
                listOf("Sehemu za hadithi" to "Mwanzo, katikati, mwisho.", "Wahusika" to "Watu au wanyama katika hadithi.", "Kufuatilia" to "Jiulize 'nini kitatokea baadaye?'."),
                listOf("Hadithi" to "A story", "Wahusika" to "Characters")),
            LessonSpec(faith, "Social Studies: Our Community",
                "A community is a group of people living and working together. It has homes, schools, shops, churches, mosques and hospitals. People in a community help each other. A teacher helps you learn. A doctor helps you stay healthy. Being kind makes the community strong.",
                listOf("What is a community?" to "A group of people living and working together.", "Places in a community" to "Homes, schools, shops, health centres.", "People who help" to "Teachers, doctors, farmers, shopkeepers."),
                listOf("Community" to "A group of people living together", "Neighbourhood" to "The area around your home")),
            LessonSpec(faith, "Social Studies: Maps and Directions",
                "A map is a drawing of a place from above. Maps help you find places. Directions tell you which way to go. North, South, East and West are the main directions. The sun rises in the East and sets in the West. A compass shows directions on a map.",
                listOf("What is a map?" to "A drawing of a place seen from above.", "Main directions" to "North, South, East and West.", "Using a map" to "Look for the compass and key to understand it."),
                listOf("Map" to "A drawing of a place", "Compass" to "A tool that shows direction")),
            LessonSpec(kevin, "Computer Studies: What is a Computer?",
                "A computer is a machine that helps you work, learn and play. It has a screen, a keyboard and a mouse. The screen shows information. The keyboard lets you type. The mouse helps you point and click. Computers follow instructions called programs.",
                listOf("Parts of a computer" to "Screen, keyboard, mouse and the computer box.", "What computers do" to "They store information and follow instructions.", "Using one safely" to "Sit up straight and take breaks."),
                listOf("Computer" to "A machine that follows instructions", "Keyboard" to "Used for typing")),
            LessonSpec(kevin, "Computer Studies: Keyboard Skills",
                "The keyboard is used for typing. Place your fingers on the middle row. Use both hands. Press keys gently. The space bar makes a space between words. The Enter key starts a new line. Practising a little every day makes you faster.",
                listOf("Good hand position" to "Fingers on the middle row, both hands ready.", "Important keys" to "Space bar, Enter, Backspace.", "Practice" to "Type short words every day to get faster."),
                listOf("Space bar" to "Adds a space between words", "Enter" to "Starts a new line"))
        )

        lessonSpecs.forEach { spec ->
            val content = contentRepo.save(Content(
                userId = spec.owner.id,
                title = spec.title,
                status = ContentStatus.READY,
                rawText = spec.raw,
                simplifiedText = lessonJson(spec),
                wordCount = spec.raw.split(Regex("\\s+")).size
            ))
            contentIds += content.id
            seedQuiz(content.id, spec.owner.id, spec.quizQuestions())
            log.info("Showcase lesson: {} (id {})", spec.title, content.id)
        }

        // ── Assignments + quiz history (spread over the past 14 days) ───────
        val now = LocalDateTime.now()
        learners.forEachIndexed { li, learner ->
            val assigned = (6 + (li * 7) % 8).coerceAtMost(contentIds.size) // 6–13 lessons
            val chosen = (0 until assigned).map { contentIds[(li * 3 + it * 5) % contentIds.size] }.distinct()
            chosen.forEachIndexed { ci, contentId ->
                val completed = ci % 3 != 2 // ~2/3 completed
                val completedAt = now.minusDays((li * 2 + ci * 3) % 14 + 1L).minusHours((li + ci) % 12L)
                if (completed) {
                    val score = 55 + ((li * 7 + ci * 11) % 46) // 55–100
                    progressRepo.save(LessonProgress(
                        user = learner, contentId = contentId,
                        quizScore = score.toDouble(), completed = true,
                        completedAt = completedAt, createdAt = completedAt.minusDays(1)
                    ))
                    quizRepo.findByContentId(contentId)?.let { quiz ->
                        attemptRepo.save(QuizAttempt(
                            quizId = quiz.id, userId = learner.id,
                            score = score / 100.0, totalQuestions = questionRepo.findByQuizId(quiz.id).size,
                            completed = true, createdAt = completedAt.minusMinutes(10), completedAt = completedAt
                        ))
                    }
                    // Guardian notification for this completion
                    guardianLinkRepo.findAll().filter { it.learnerId == learner.id }.forEach { link ->
                        if (guardianLinkRepo.findAll().count { it.guardianId == link.guardianId } <= 2) {
                            notificationRepo.save(Notification(
                                userId = link.guardianId, type = "QUIZ_COMPLETED",
                                title = "${learner.name} completed a lesson",
                                body = "${learner.name} scored $score% on \"${lessonTitle(contentId)}\". " +
                                    if (score >= 80) "Excellent work! 🎉" else if (score >= 60) "Good effort! 💪" else "They may need a little extra support.",
                                createdAt = completedAt.toInstant(java.time.ZoneOffset.UTC)
                            ))
                        }
                    }
                } else {
                    progressRepo.save(LessonProgress(
                        user = learner, contentId = contentId,
                        completed = false, createdAt = now.minusDays((li + ci) % 5 + 1L)
                    ))
                    notificationRepo.save(Notification(
                        userId = learner.id, type = "LESSON_ASSIGNED",
                        title = "New lesson assigned",
                        body = "Your teacher assigned you: \"${lessonTitle(contentId)}\". Open it from your home screen.",
                        link = "/lesson/$contentId",
                        createdAt = now.minusDays((li + ci) % 5 + 1L).toInstant(java.time.ZoneOffset.UTC)
                    ))
                }
            }
        }

        // ── Teacher + admin notifications ────────────────────────────────────
        notificationRepo.save(Notification(
            userId = alice.id, type = "SUPPORT_SIGNAL",
            title = "Learner may need support",
            body = "Amani Wanjiku was flagged for review (low quiz score). Open the support signals page to review.",
            createdAt = now.minusDays(2).toInstant(java.time.ZoneOffset.UTC)
        ))
        notificationRepo.save(Notification(
            userId = alice.id, type = "PROGRESS_REPORT",
            title = "Weekly progress report",
            body = "Your learners completed 18 lessons this week with an average score of 74%.",
            createdAt = now.minusDays(1).toInstant(java.time.ZoneOffset.UTC)
        ))
        notificationRepo.save(Notification(
            userId = admin.id, type = "PROGRESS_REPORT",
            title = "Platform activity summary",
            body = "Sunrise Inclusive Academy: 30 learners active this week, 14 lessons available, 52 quiz questions.",
            createdAt = now.minusDays(1).toInstant(java.time.ZoneOffset.UTC)
        ))
        notificationRepo.save(Notification(
            userId = admin.id, type = "PROGRESS_REPORT",
            title = "New school registered",
            body = "Sunrise Inclusive Academy joined the platform and is ready for onboarding.",
            createdAt = now.minusDays(6).toInstant(java.time.ZoneOffset.UTC)
        ))

        log.info("Showcase seed complete: 1 admin, ${teachers.size} teachers, ${learners.size} learners, ${guardians.size} guardians, ${contentIds.size} lessons.")
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private fun createUser(email: String, rawPassword: String, name: String, role: UserRole, institutionId: Long?): User =
        userRepository.findByEmail(email) ?: userRepository.save(
            User(email = email, name = name, password = passwordEncoder.encode(rawPassword), role = role, institutionId = institutionId)
        )

    private fun ensureProfile(user: User, sneType: SneType) {
        if (learnerProfileRepo.findByUserId(user.id) == null) {
            learnerProfileRepo.save(LearnerProfile(user = user, sneType = sneType, preferences = emptyMap(), adaptationState = emptyMap()))
        }
    }

    private fun lessonTitle(contentId: Long): String =
        contentRepo.findById(contentId).map { it.title ?: "Lesson $contentId" }.orElse("Lesson $contentId")

    private fun lessonJson(spec: LessonSpec): String {
        val sections = spec.sections.map { (h, b) -> mapOf("heading" to h, "body" to b) }
        val terms = spec.terms.map { (t, d) -> mapOf("term" to t, "definition" to d) }
        val doc = mapOf(
            "title" to spec.title,
            "sections" to sections,
            "key_terms" to terms
        )
        return objectMapper.writeValueAsString(mapOf("lesson" to doc))
    }

    private fun seedQuiz(contentId: Long, ownerId: Long, questions: List<QuizQuestionSpec>) {
        if (quizRepo.findByContentId(contentId) != null) return
        val quiz = quizRepo.save(Quiz(contentId = contentId, userId = ownerId))
        questions.forEach { q ->
            questionRepo.save(QuizQuestion(
                quizId = quiz.id, question = q.question,
                optionA = q.a, optionB = q.b, optionC = q.c, optionD = q.d,
                correctOption = q.correct, explanation = q.explanation
            ))
        }
    }

    private data class LessonSpec(
        val owner: User,
        val title: String,
        val raw: String,
        val sections: List<Pair<String, String>>,
        val terms: List<Pair<String, String>>
    ) {
        fun quizQuestions(): List<QuizQuestionSpec> = when (title) {
            "Mathematics: Fractions — What is a half?" -> listOf(
                QuizQuestionSpec("If a cake is cut into 2 equal pieces, each piece is:", "A half", "A quarter", "A whole", "A third", "A", "Two equal pieces make one half."),
                QuizQuestionSpec("The top number of a fraction is called the:", "Denominator", "Numerator", "Sum", "Total", "B", "The top number counts the parts you have."),
                QuizQuestionSpec("Two quarters equal:", "One half", "One whole", "Three quarters", "One third", "A", "2/4 is the same as 1/2."),
                QuizQuestionSpec("A quarter is written as:", "1/2", "1/3", "1/4", "1/5", "C", "A quarter is one of four equal parts.")
            )
            "Mathematics: Addition and Subtraction" -> listOf(
                QuizQuestionSpec("3 + 2 =", "4", "5", "6", "1", "B", "Putting 3 and 2 together gives 5."),
                QuizQuestionSpec("5 - 2 =", "2", "3", "4", "1", "B", "Taking 2 away from 5 leaves 3."),
                QuizQuestionSpec("The answer to an addition is called the:", "Difference", "Sum", "Product", "Total", "B", "Addition gives a sum."),
                QuizQuestionSpec("If you have 4 apples and get 3 more, how many do you have?", "6", "7", "8", "5", "B", "4 + 3 = 7.")
            )
            "Mathematics: Shapes Around Us" -> listOf(
                QuizQuestionSpec("Which shape has three sides?", "Circle", "Square", "Triangle", "Rectangle", "C", "A triangle has three sides and three corners."),
                QuizQuestionSpec("A shape that is round with no corners is a:", "Square", "Circle", "Triangle", "Rectangle", "B", "A circle is round."),
                QuizQuestionSpec("A square has:", "Three sides", "Four equal sides", "Two sides", "Five sides", "B", "All four sides of a square are equal."),
                QuizQuestionSpec("Which shape has two long and two short sides?", "Square", "Triangle", "Rectangle", "Circle", "C", "A rectangle has two long and two short sides.")
            )
            "Science: Plants and Photosynthesis" -> listOf(
                QuizQuestionSpec("Plants make their own food using:", "Soil", "Sunlight", "Rain only", "Wind", "B", "Sunlight powers photosynthesis."),
                QuizQuestionSpec("The green substance in leaves is called:", "Glucose", "Chlorophyll", "Carbon", "Oxygen", "B", "Chlorophyll captures sunlight."),
                QuizQuestionSpec("Plants take in water through their:", "Leaves", "Flowers", "Roots", "Stems", "C", "Roots take in water from the soil."),
                QuizQuestionSpec("Plants give out a gas we breathe called:", "Carbon dioxide", "Oxygen", "Nitrogen", "Smoke", "B", "Plants release oxygen.")
            )
            "Science: The Human Body — Five Senses" -> listOf(
                QuizQuestionSpec("You see with your:", "Ears", "Eyes", "Nose", "Skin", "B", "Sight uses your eyes."),
                QuizQuestionSpec("You hear with your:", "Eyes", "Tongue", "Ears", "Nose", "C", "Hearing uses your ears."),
                QuizQuestionSpec("You taste with your:", "Tongue", "Skin", "Ears", "Eyes", "A", "Taste uses your tongue."),
                QuizQuestionSpec("How many senses do you have?", "Three", "Four", "Five", "Six", "C", "Sight, hearing, smell, taste and touch.")
            )
            "English: Nouns and Verbs" -> listOf(
                QuizQuestionSpec("Which word is a noun?", "Run", "Teacher", "Quickly", "Read", "B", "Teacher names a person."),
                QuizQuestionSpec("Which word is a verb?", "Book", "School", "Read", "Happy", "C", "Read is an action word."),
                QuizQuestionSpec("In 'The girl reads a book', the verb is:", "Girl", "Book", "Reads", "The", "C", "Reads shows the action."),
                QuizQuestionSpec("A noun names a:", "Action", "Person, place or thing", "Colour", "Direction", "B", "Nouns name people, places or things.")
            )
            "English: Reading a Story" -> listOf(
                QuizQuestionSpec("A story has a beginning, a middle and an:", "Title", "End", "Page", "Cover", "B", "Stories end with a finish."),
                QuizQuestionSpec("The people in a story are called:", "Readers", "Characters", "Authors", "Pages", "B", "Characters are the people in a story."),
                QuizQuestionSpec("Where a story happens is called the:", "Plot", "Setting", "Chapter", "Cover", "B", "The setting is where the story happens."),
                QuizQuestionSpec("Which question helps you follow a story?", "What happens next?", "What is the price?", "What time is it?", "Who wrote it?", "A", "Asking what happens next keeps you on track.")
            )
            "Kiswahili: Maneno ya Kiswahili" -> listOf(
                QuizQuestionSpec("'Asante' inamaanisha:", "Sorry", "Thank you", "Please", "Goodbye", "B", "Asante means thank you."),
                QuizQuestionSpec("'Tafadhali' inamaanisha:", "Please", "Thank you", "Hello", "Welcome", "A", "Tafadhali means please."),
                QuizQuestionSpec("'Habari' ni:", "Salamu", "Jina", "Chakula", "Kitabu", "A", "Habari ni salamu ya kawaida."),
                QuizQuestionSpec("Lugha ya Kenya ni:", "Kifaransa", "Kiswahili", "Kijerumani", "Kichina", "B", "Kiswahili ni lugha ya Kenya.")
            )
            "Kiswahili: Kusoma Hadithi" -> listOf(
                QuizQuestionSpec("Hadithi ina mwanzo, katikati na:", "Mwisho", "Jina", "Ukurasa", "Picha", "A", "Hadithi ina mwisho."),
                QuizQuestionSpec("Watu katika hadithi wanaitwa:", "Wasomaji", "Wahusika", "Waandishi", "Wanafunzi", "B", "Wahusika ni watu katika hadithi."),
                QuizQuestionSpec("Mwanzo wa hadithi hutambulisha:", "Wahusika", "Mwisho", "Maneno", "Herufi", "A", "Mwanzo hutambulisha wahusika."),
                QuizQuestionSpec("Kusoma hadithi husaidia:", "Kujifunza maneno mapya", "Kulala", "Kukimbia", "Kuimba", "A", "Kusoma husaidia kujifunza maneno mapya.")
            )
            "Social Studies: Our Community" -> listOf(
                QuizQuestionSpec("A community is a group of people:", "Living and working together", "Living far apart", "Who never meet", "Who travel only", "A", "A community is people living and working together."),
                QuizQuestionSpec("Which person helps you learn?", "Doctor", "Teacher", "Farmer", "Driver", "B", "Teachers help you learn."),
                QuizQuestionSpec("Which place helps sick people?", "School", "Shop", "Hospital", "Farm", "C", "Hospitals help sick people."),
                QuizQuestionSpec("Being kind makes a community:", "Weaker", "Stronger", "Smaller", "Quieter", "B", "Kindness makes a community strong.")
            )
            "Social Studies: Maps and Directions" -> listOf(
                QuizQuestionSpec("A map is a drawing of a place:", "From above", "From below", "Inside out", "Upside down", "A", "Maps show places from above."),
                QuizQuestionSpec("Which is a main direction?", "North", "Near", "Next", "Never", "A", "North, South, East and West are main directions."),
                QuizQuestionSpec("The sun rises in the:", "West", "East", "North", "South", "B", "The sun rises in the East."),
                QuizQuestionSpec("A compass shows:", "Time", "Direction", "Distance", "Weather", "B", "A compass shows direction.")
            )
            "Computer Studies: What is a Computer?" -> listOf(
                QuizQuestionSpec("Which part shows information?", "Mouse", "Keyboard", "Screen", "Printer", "C", "The screen shows information."),
                QuizQuestionSpec("Which part do you use for typing?", "Keyboard", "Mouse", "Screen", "Speaker", "A", "The keyboard is for typing."),
                QuizQuestionSpec("Computers follow instructions called:", "Games", "Programs", "Pictures", "Songs", "B", "Programs are instructions for computers."),
                QuizQuestionSpec("Which is a safe computer habit?", "Taking breaks", "Sitting too close", "Never resting", "Touching the screen", "A", "Take breaks and sit up straight.")
            )
            "Computer Studies: Keyboard Skills" -> listOf(
                QuizQuestionSpec("Which key adds a space between words?", "Enter", "Space bar", "Backspace", "Shift", "B", "The space bar adds spaces."),
                QuizQuestionSpec("Which key starts a new line?", "Space bar", "Backspace", "Enter", "Tab", "C", "Enter starts a new line."),
                QuizQuestionSpec("Where should your fingers rest?", "On the middle row", "On the screen", "On the mouse only", "Anywhere", "A", "Fingers rest on the middle row."),
                QuizQuestionSpec("How do you get faster at typing?", "Practice every day", "Type faster randomly", "Never type", "Use one finger", "A", "Daily practice makes you faster.")
            )
            else -> listOf(
                QuizQuestionSpec("What is the main idea of this lesson?", "The first idea", "The central point", "The last word", "The title only", "B", "The main idea is the central point of the lesson."),
                QuizQuestionSpec("Which key term belongs to this lesson?", "Key term A", "Key term B", "Key term C", "Key term D", "A", "Review the key terms in the lesson.")
            )
        }
    }

    private data class QuizQuestionSpec(
        val question: String, val a: String, val b: String, val c: String, val d: String,
        val correct: String, val explanation: String
    )
}