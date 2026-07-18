const { Client } = require("pg");

const client = new Client({
  connectionString: "postgresql://elekeza_user:your_db_password@your_db_host:5432/elekeza_prod"
});

(async () => {
  await client.connect();
  
  // Find student ID for student@elekeza.app
  const studentRes = await client.query("SELECT id FROM users WHERE email = 'student@elekeza.app'");
  const studentId = studentRes.rows[0].id;

  // Find parent ID
  const parentRes = await client.query("SELECT id FROM users WHERE email = 'parent@elekeza.app'");
  const parentId = parentRes.rows[0].id;

  // Insert guardian link if missing
  await client.query(
    "INSERT INTO guardian_links (guardian_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [parentId, studentId]
  );

  console.log(`Linked parent ${parentId} to student ${studentId}`);
  
  // Optionally create a sample lesson progress to show data
  // (we'll do this via API later)
  
  await client.end();
})();
