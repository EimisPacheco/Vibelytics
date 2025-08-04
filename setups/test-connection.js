// Test TiDB Connection
// Run this script to verify your TiDB setup is working correctly

const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('🔌 Testing TiDB connection...\n');
  
  const config = {
    host: 'gateway01.us-east-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '4GESgVjG1QNSAoU.root',
    password: 'xOgHk9Jv2BCRqXmz',
    database: 'youtube-comments-analytics',
    ssl: {
      rejectUnauthorized: true
    }
  };
  
  try {
    // Create connection
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected to TiDB successfully!\n');
    
    // Test 1: Check database
    const [dbResult] = await connection.execute('SELECT DATABASE() as db');
    console.log(`📊 Current database: ${dbResult[0].db}\n`);
    
    // Test 2: Check vector support
    console.log('🔍 Testing vector support...');
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS vector_test (
          id INT PRIMARY KEY,
          test_vector VECTOR(3)
        )
      `);
      
      await connection.execute(`
        INSERT INTO vector_test (id, test_vector) 
        VALUES (1, '[1.0, 2.0, 3.0]')
        ON DUPLICATE KEY UPDATE test_vector = VALUES(test_vector)
      `);
      
      const [vectorResult] = await connection.execute('SELECT * FROM vector_test');
      console.log('✅ Vector support confirmed!');
      console.log('   Sample vector:', vectorResult[0].test_vector);
      
      // Clean up test table
      await connection.execute('DROP TABLE vector_test');
      
    } catch (error) {
      console.error('❌ Vector support test failed:', error.message);
    }
    
    // Test 3: List tables
    console.log('\n📋 Existing tables:');
    const [tables] = await connection.execute('SHOW TABLES');
    if (tables.length === 0) {
      console.log('   No tables found. Run init-tidb.sql to create tables.');
    } else {
      tables.forEach(table => {
        const tableName = Object.values(table)[0];
        console.log(`   - ${tableName}`);
      });
    }
    
    // Test 4: Check for vector indexes
    console.log('\n🔍 Checking vector indexes...');
    try {
      const [indexes] = await connection.execute(`
        SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME 
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = 'youtube-comments-analytics' 
        AND INDEX_NAME LIKE 'vec_%'
      `);
      
      if (indexes.length > 0) {
        console.log('✅ Vector indexes found:');
        indexes.forEach(index => {
          console.log(`   - ${index.TABLE_NAME}.${index.INDEX_NAME} on column ${index.COLUMN_NAME}`);
        });
      } else {
        console.log('   No vector indexes found yet.');
      }
    } catch (error) {
      console.log('   Vector index check skipped (tables may not exist yet)');
    }
    
    // Close connection
    await connection.end();
    console.log('\n✅ All tests completed successfully!');
    console.log('🚀 Your TiDB instance is ready for the YouTube Comment Analytics extension.\n');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('\nPlease check:');
    console.error('1. Your cluster is running in TiDB Cloud console');
    console.error('2. Your password is correct');
    console.error('3. Your IP is whitelisted (if using IP access control)');
    console.error('4. Network connectivity to TiDB Cloud\n');
  }
}

// Run the test
testConnection();

// Instructions for running this script
console.log(`
To run this test:
1. Install mysql2: npm install mysql2
2. Run: node setup/test-connection.js

If you see errors about missing mysql2, you can test the connection using:
- TiDB Cloud SQL Editor in your browser
- MySQL command line client
- Any MySQL GUI tool (TablePlus, DBeaver, etc.)
`);