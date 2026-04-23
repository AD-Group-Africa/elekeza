CREATE TABLE guardians (
                           id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                           learner_id UUID NOT NULL,
                           full_name VARCHAR(255) NOT NULL,
                           relationship VARCHAR(100) NOT NULL,
                           phone VARCHAR(50),
                           email VARCHAR(255),
                           created_at TIMESTAMP DEFAULT NOW()
);