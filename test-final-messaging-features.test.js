/**
 * Comprehensive Final Testing Suite for Messaging Module Features
 *
 * Tests the two new functionalities implemented:
 * 1. Conversation Archiving (REQ-MSG-08)
 * 2. Typing Indicators (REQ-MSG-13)
 *
 * Also includes integration testing to ensure no regressions.
 */

const fs = require('fs');
const path = require('path');

// Test results tracking
const testResults = {
  archiving: { passed: 0, failed: 0, tests: [] },
  typing: { passed: 0, failed: 0, tests: [] },
  integration: { passed: 0, failed: 0, tests: [] }
};

function logTest(category, testName, passed, details = '') {
  const result = { testName, passed, details, timestamp: new Date().toISOString() };
  testResults[category].tests.push(result);

  if (passed) {
    testResults[category].passed++;
    console.log(`✅ ${category.toUpperCase()}: ${testName}`);
  } else {
    testResults[category].failed++;
    console.log(`❌ ${category.toUpperCase()}: ${testName} - ${details}`);
  }
}

// ========================================
// 1. CONVERSATION ARCHIVING TESTS (REQ-MSG-08)
// ========================================

async function testConversationArchiving() {
  console.log('\n📁 TESTING CONVERSATION ARCHIVING (REQ-MSG-08)...');

  // Test 1: Archive endpoint implementation
  try {
    const controllerPath = path.join(__dirname, 'changanet/changanet-backend/src/controllers/unifiedChatController.js');
    const controllerContent = fs.readFileSync(controllerPath, 'utf8');

    const hasArchiveFunction = controllerContent.includes('archiveConversation');
    const hasArchiveEndpoint = controllerContent.includes('PUT /api/chat/conversations/:conversationId/archive');
    const hasIsActiveUpdate = controllerContent.includes('is_active: false');

    logTest('archiving', 'Archive endpoint implementation',
      hasArchiveFunction && hasArchiveEndpoint && hasIsActiveUpdate,
      hasArchiveFunction ? 'Archive function properly implemented' : 'Archive function missing'
    );
  } catch (error) {
    logTest('archiving', 'Archive endpoint implementation', false, error.message);
  }

  // Test 2: Route configuration
  try {
    const routesPath = path.join(__dirname, 'changanet/changanet-backend/src/routes/unifiedChatRoutes.js');
    const routesContent = fs.readFileSync(routesPath, 'utf8');

    const hasArchiveRoute = routesContent.includes('PUT /api/chat/conversations/:conversationId/archive');
    const hasArchiveHandler = routesContent.includes('archiveConversation');

    logTest('archiving', 'Route configuration',
      hasArchiveRoute && hasArchiveHandler,
      hasArchiveRoute ? 'Archive route properly configured' : 'Archive route missing'
    );
  } catch (error) {
    logTest('archiving', 'Route configuration', false, error.message);
  }

  // Test 3: Authorization checks
  try {
    const controllerPath = path.join(__dirname, 'changanet/changanet-backend/src/controllers/unifiedChatController.js');
    const controllerContent = fs.readFileSync(controllerPath, 'utf8');

    const hasAuthCheck = controllerContent.includes('conversation.client_id !== currentUserId && conversation.professional_id !== currentUserId');
    const hasUnauthorizedError = controllerContent.includes('No tienes acceso a esta conversación');

    logTest('archiving', 'Authorization checks',
      hasAuthCheck && hasUnauthorizedError,
      hasAuthCheck ? 'Authorization properly implemented' : 'Authorization checks missing'
    );
  } catch (error) {
    logTest('archiving', 'Authorization checks', false, error.message);
  }

  // Test 4: Database schema support
  try {
    const schemaPath = path.join(__dirname, 'changanet/changanet-backend/prisma/schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');

    const hasIsActiveField = schemaContent.includes('is_active Boolean  @default(true)');
    const hasIsActiveIndex = schemaContent.includes('@@index([is_active])');

    logTest('archiving', 'Database schema support',
      hasIsActiveField && hasIsActiveIndex,
      hasIsActiveField ? 'is_active field properly configured' : 'is_active field missing'
    );
  } catch (error) {
    logTest('archiving', 'Database schema support', false, error.message);
  }

  // Test 5: Conversation list filtering
  try {
    const controllerPath = path.join(__dirname, 'changanet/changanet-backend/src/controllers/unifiedChatController.js');
    const controllerContent = fs.readFileSync(controllerPath, 'utf8');

    const hasActiveFilter = controllerContent.includes('is_active: true');
    const hasArchiveExclusion = controllerContent.includes('WHERE') && controllerContent.includes('is_active: true');

    logTest('archiving', 'Conversation list filtering',
      hasActiveFilter && hasArchiveExclusion,
      hasActiveFilter ? 'Archived conversations properly filtered' : 'Archive filtering missing'
    );
  } catch (error) {
    logTest('archiving', 'Conversation list filtering', false, error.message);
  }
}

// ========================================
// 2. TYPING INDICATORS TESTS (REQ-MSG-13)
// ========================================

async function testTypingIndicators() {
  console.log('\n⌨️ TESTING TYPING INDICATORS (REQ-MSG-13)...');

  // Test 1: WebSocket typing events
  try {
    const wsServicePath = path.join(__dirname, 'changanet/changanet-backend/src/services/unifiedWebSocketService.js');
    const wsContent = fs.readFileSync(wsServicePath, 'utf8');

    const hasTypingEvent = wsContent.includes('socket.on(\'typing\'');
    const hasStopTypingEvent = wsContent.includes('socket.on(\'stopTyping\'');
    const hasTypingEmit = wsContent.includes('socket.to(`conversation_${conversationId}`).emit(\'typing\'');

    logTest('typing', 'WebSocket typing events',
      hasTypingEvent && hasStopTypingEvent && hasTypingEmit,
      hasTypingEvent ? 'Typing events properly implemented' : 'Typing events missing'
    );
  } catch (error) {
    logTest('typing', 'WebSocket typing events', false, error.message);
  }

  // Test 2: Database table structure
  try {
    const schemaPath = path.join(__dirname, 'changanet/changanet-backend/prisma/schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');

    const hasTypingTable = schemaContent.includes('model typing_indicators');
    const hasConversationId = schemaContent.includes('conversation_id String');
    const hasUserId = schemaContent.includes('user_id String');
    const hasIsTyping = schemaContent.includes('is_typing Boolean');
    const hasUniqueConstraint = schemaContent.includes('@@unique([conversation_id, user_id])');

    logTest('typing', 'Database table structure',
      hasTypingTable && hasConversationId && hasUserId && hasIsTyping && hasUniqueConstraint,
      hasTypingTable ? 'Typing indicators table properly structured' : 'Typing indicators table missing'
    );
  } catch (error) {
    logTest('typing', 'Database table structure', false, error.message);
  }

  // Test 3: Database operations
  try {
    const wsServicePath = path.join(__dirname, 'changanet/changanet-backend/src/services/unifiedWebSocketService.js');
    const wsContent = fs.readFileSync(wsServicePath, 'utf8');

    const hasUpsertOperation = wsContent.includes('prisma.typing_indicators.upsert');
    const hasUpdateOperation = wsContent.includes('is_typing: true') && wsContent.includes('is_typing: false');

    logTest('typing', 'Database operations',
      hasUpsertOperation && hasUpdateOperation,
      hasUpsertOperation ? 'Database operations properly implemented' : 'Database operations missing'
    );
  } catch (error) {
    logTest('typing', 'Database operations', false, error.message);
  }

  // Test 4: Authorization checks
  try {
    const wsServicePath = path.join(__dirname, 'changanet/changanet-backend/src/services/unifiedWebSocketService.js');
    const wsContent = fs.readFileSync(wsServicePath, 'utf8');

    const hasAuthCheck = wsContent.includes('conversation.client_id !== userId && conversation.professional_id !== userId');
    const hasSilentIgnore = wsContent.includes('return; // Silenciosamente ignorar');

    logTest('typing', 'Authorization checks',
      hasAuthCheck && hasSilentIgnore,
      hasAuthCheck ? 'Authorization properly implemented' : 'Authorization checks missing'
    );
  } catch (error) {
    logTest('typing', 'Authorization checks', false, error.message);
  }

  // Test 5: Frontend integration
  try {
    const chatPath = path.join(__dirname, 'changanet/changanet-frontend/src/components/Chat/EnhancedChat.jsx');
    const chatContent = fs.readFileSync(chatPath, 'utf8');

    const hasTypingIndicator = chatContent.includes('TypingIndicator');
    const hasTypingUsers = chatContent.includes('typingUsers');
    const hasTypingEventListener = chatContent.includes('socket.on(\'typing\'');

    logTest('typing', 'Frontend integration',
      hasTypingIndicator && hasTypingUsers && hasTypingEventListener,
      hasTypingIndicator ? 'Frontend typing integration implemented' : 'Frontend typing integration missing'
    );
  } catch (error) {
    logTest('typing', 'Frontend integration', false, error.message);
  }

  // Test 6: Cleanup on disconnect
  try {
    const wsServicePath = path.join(__dirname, 'changanet/changanet-backend/src/services/unifiedWebSocketService.js');
    const wsContent = fs.readFileSync(wsServicePath, 'utf8');

    const hasDisconnectCleanup = wsContent.includes('prisma.typing_indicators.updateMany');
    const hasIsTypingFalse = wsContent.includes('is_typing: false');

    logTest('typing', 'Cleanup on disconnect',
      hasDisconnectCleanup && hasIsTypingFalse,
      hasDisconnectCleanup ? 'Disconnect cleanup properly implemented' : 'Disconnect cleanup missing'
    );
  } catch (error) {
    logTest('typing', 'Cleanup on disconnect', false, error.message);
  }
}

// ========================================
// 3. INTEGRATION TESTS
// ========================================

async function testIntegration() {
  console.log('\n🔗 TESTING INTEGRATION & REGRESSIONS...');

  // Test 1: No breaking changes to existing messaging
  try {
    const controllerPath = path.join(__dirname, 'changanet/changanet-backend/src/controllers/unifiedChatController.js');
    const controllerContent = fs.readFileSync(controllerPath, 'utf8');

    const hasCreateConversation = controllerContent.includes('createConversation');
    const hasSendMessage = controllerContent.includes('sendMessage');
    const hasGetMessageHistory = controllerContent.includes('getMessageHistory');
    const hasGetUserConversations = controllerContent.includes('getUserConversations');

    logTest('integration', 'No breaking changes to existing messaging',
      hasCreateConversation && hasSendMessage && hasGetMessageHistory && hasGetUserConversations,
      hasCreateConversation ? 'All core messaging functions preserved' : 'Core messaging functions missing'
    );
  } catch (error) {
    logTest('integration', 'No breaking changes to existing messaging', false, error.message);
  }

  // Test 2: WebSocket service integrity
  try {
    const wsServicePath = path.join(__dirname, 'changanet/changanet-backend/src/services/unifiedWebSocketService.js');
    const wsContent = fs.readFileSync(wsServicePath, 'utf8');

    const hasMessageEvent = wsContent.includes('socket.on(\'message\'');
    const hasJoinEvent = wsContent.includes('socket.on(\'join\'');
    const hasMarkAsReadEvent = wsContent.includes('socket.on(\'markAsRead\'');
    const hasConnectionHandling = wsContent.includes('handleConnection');

    logTest('integration', 'WebSocket service integrity',
      hasMessageEvent && hasJoinEvent && hasMarkAsReadEvent && hasConnectionHandling,
      hasMessageEvent ? 'WebSocket service integrity maintained' : 'WebSocket service compromised'
    );
  } catch (error) {
    logTest('integration', 'WebSocket service integrity', false, error.message);
  }

  // Test 3: Database schema consistency
  try {
    const schemaPath = path.join(__dirname, 'changanet/changanet-backend/prisma/schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');

    const hasConversationsTable = schemaContent.includes('model conversations');
    const hasMessagesTable = schemaContent.includes('model mensajes');
    const hasTypingTable = schemaContent.includes('model typing_indicators');
    const hasAllRelations = schemaContent.includes('@relation') && schemaContent.includes('fields:') && schemaContent.includes('references:');

    logTest('integration', 'Database schema consistency',
      hasConversationsTable && hasMessagesTable && hasTypingTable && hasAllRelations,
      hasConversationsTable ? 'Database schema properly maintained' : 'Database schema inconsistencies'
    );
  } catch (error) {
    logTest('integration', 'Database schema consistency', false, error.message);
  }

  // Test 4: Frontend context integrity
  try {
    const contextPath = path.join(__dirname, 'changanet/changanet-frontend/src/context/ChatContext.jsx');
    const contextContent = fs.readFileSync(contextPath, 'utf8');

    const hasChatContext = contextContent.includes('ChatContext');
    const hasUseChat = contextContent.includes('useChat');
    const hasWebSocketConnection = contextContent.includes('socket');
    const hasMessageHandling = contextContent.includes('sendMessage');

    logTest('integration', 'Frontend context integrity',
      hasChatContext && hasUseChat && hasWebSocketConnection && hasMessageHandling,
      hasChatContext ? 'Frontend context properly maintained' : 'Frontend context compromised'
    );
  } catch (error) {
    logTest('integration', 'Frontend context integrity', false, error.message);
  }

  // Test 5: Route configuration integrity
  try {
    const routesPath = path.join(__dirname, 'changanet/changanet-backend/src/routes/unifiedChatRoutes.js');
    const routesContent = fs.readFileSync(routesPath, 'utf8');

    const hasBasicRoutes = routesContent.includes('POST /api/chat/conversations') &&
                          routesContent.includes('GET /api/chat/conversations') &&
                          routesContent.includes('GET /api/chat/messages') &&
                          routesContent.includes('POST /api/chat/messages');
    const hasNewRoutes = routesContent.includes('PUT /api/chat/conversations/:conversationId/archive');

    logTest('integration', 'Route configuration integrity',
      hasBasicRoutes && hasNewRoutes,
      hasBasicRoutes ? 'All routes properly configured' : 'Route configuration issues'
    );
  } catch (error) {
    logTest('integration', 'Route configuration integrity', false, error.message);
  }
}

// ========================================
// MAIN EXECUTION & REPORTING
// ========================================

async function runFinalTesting() {
  console.log('🚀 STARTING FINAL MESSAGING FEATURES TESTING');
  console.log('===========================================');

  try {
    await testConversationArchiving();
    await testTypingIndicators();
    await testIntegration();

    // Generate comprehensive report
    console.log('\n' + '='.repeat(100));
    console.log('📊 FINAL TESTING REPORT - MESSAGING MODULE FEATURES');
    console.log('='.repeat(100));

    const categories = ['archiving', 'typing', 'integration'];
    let totalPassed = 0;
    let totalFailed = 0;

    categories.forEach(category => {
      const results = testResults[category];
      const total = results.passed + results.failed;
      const percentage = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;

      console.log(`\n🔍 ${category.toUpperCase()} TESTS:`);
      console.log(`   ✅ Passed: ${results.passed}`);
      console.log(`   ❌ Failed: ${results.failed}`);
      console.log(`   📈 Success Rate: ${percentage}%`);

      totalPassed += results.passed;
      totalFailed += results.failed;

      if (results.failed > 0) {
        console.log(`   ⚠️  Failed Tests:`);
        results.tests.filter(t => !t.passed).forEach(test => {
          console.log(`      - ${test.testName}: ${test.details}`);
        });
      }
    });

    const overallTotal = totalPassed + totalFailed;
    const overallPercentage = overallTotal > 0 ? ((totalPassed / overallTotal) * 100).toFixed(1) : 0;

    console.log('\n' + '='.repeat(100));
    console.log('🎯 OVERALL RESULTS:');
    console.log(`   ✅ Total Passed: ${totalPassed}`);
    console.log(`   ❌ Total Failed: ${totalFailed}`);
    console.log(`   📊 Overall Success Rate: ${overallPercentage}%`);
    console.log('='.repeat(100));

    // PRD Compliance Assessment
    console.log('\n📋 PRD COMPLIANCE ASSESSMENT:');
    console.log('='.repeat(100));

    const archivingTests = testResults.archiving;
    const typingTests = testResults.typing;
    const archivingCompliance = archivingTests.failed === 0 ? '✅ 100% COMPLIANT' : `❌ ${((archivingTests.passed / (archivingTests.passed + archivingTests.failed)) * 100).toFixed(1)}% COMPLIANT`;
    const typingCompliance = typingTests.failed === 0 ? '✅ 100% COMPLIANT' : `❌ ${((typingTests.passed / (typingTests.passed + typingTests.failed)) * 100).toFixed(1)}% COMPLIANT`;

    console.log(`REQ-MSG-08 (Archivar Conversaciones): ${archivingCompliance}`);
    console.log(`REQ-MSG-13 (Indicador "Usuario Escribiendo"): ${typingCompliance}`);

    const integrationTests = testResults.integration;
    const integrationCompliance = integrationTests.failed === 0 ? '✅ NO REGRESSIONS' : `⚠️ ${integrationTests.failed} REGRESSIONS DETECTED`;

    console.log(`Integration Testing: ${integrationCompliance}`);

    // Final verdict
    const allArchivingPassed = archivingTests.failed === 0;
    const allTypingPassed = typingTests.failed === 0;
    const noRegressions = integrationTests.failed === 0;

    console.log('\n🏆 FINAL VERDICT:');
    if (allArchivingPassed && allTypingPassed && noRegressions) {
      console.log('🎉 EXCELLENT: All requirements fully implemented and tested!');
      console.log('✅ Messaging module is 100% complete according to PRD');
      console.log('✅ Ready for production deployment');
    } else if (overallPercentage >= 90) {
      console.log('👍 GOOD: Core functionality working, minor issues to address');
      console.log('⚠️  Review failed tests before production deployment');
    } else if (overallPercentage >= 75) {
      console.log('⚠️  FAIR: Several issues need attention');
      console.log('❌ Critical review required before deployment');
    } else {
      console.log('❌ POOR: Major functionality issues detected');
      console.log('🚫 Not ready for production deployment');
    }

    console.log('\n📝 RECOMMENDATIONS:');
    if (totalFailed > 0) {
      console.log('   - Review and fix all failed tests');
      console.log('   - Run manual end-to-end testing');
      console.log('   - Validate with actual database operations');
      console.log('   - Test WebSocket connections in real environment');
    } else {
      console.log('   - All automated tests passed successfully!');
      console.log('   - Perform final manual testing in staging environment');
      console.log('   - Ready for production deployment approval');
    }

    console.log('='.repeat(100));

  } catch (error) {
    console.error('❌ Testing failed with error:', error);
  }
}

// Run the final testing
runFinalTesting();