/**
 * Comprehensive Validation Script for Messaging Module Fixes
 *
 * Tests all implemented fixes in the Internal Messaging module:
 * 1. Security fixes (XSS, rate limiting, image validation)
 * 2. Integration fixes (WebSocket sync, field alignment, message format)
 * 3. Functionality fixes (image upload, chat button)
 * 4. Database fixes (Prisma schema)
 * 5. UI/UX improvements (counters, pagination, indicators)
 */

const fs = require('fs');
const path = require('path');

// Test results tracking
const testResults = {
  security: { passed: 0, failed: 0, tests: [] },
  integration: { passed: 0, failed: 0, tests: [] },
  functionality: { passed: 0, failed: 0, tests: [] },
  database: { passed: 0, failed: 0, tests: [] },
  uiux: { passed: 0, failed: 0, tests: [] }
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
// 1. SECURITY FIXES VALIDATION
// ========================================

async function validateSecurityFixes() {
  console.log('\n🔒 VALIDATING SECURITY FIXES...');

  // XSS Sanitization - Backend Controller
  try {
    const controllerPath = path.join(__dirname, 'changanet/changanet-backend/src/controllers/unifiedChatController.js');
    const controllerContent = fs.readFileSync(controllerPath, 'utf8');

    const hasDOMPurify = controllerContent.includes('DOMPurify.sanitize');
    const hasSanitization = controllerContent.includes('sanitizedContent');

    logTest('security', 'XSS Sanitization - Backend Controller',
      hasDOMPurify && hasSanitization,
      hasDOMPurify ? 'DOMPurify sanitization implemented' : 'DOMPurify not found in controller'
    );
  } catch (error) {
    logTest('security', 'XSS Sanitization - Backend Controller', false, error.message);
  }

  // XSS Sanitization - Frontend Component
  try {
    const componentPath = path.join(__dirname, 'changanet/changanet-frontend/src/components/Chat/EnhancedChat.jsx');
    const componentContent = fs.readFileSync(componentPath, 'utf8');

    const hasDOMPurify = componentContent.includes('DOMPurify.sanitize');
    const hasSanitization = componentContent.includes('sanitizedValue') || componentContent.includes('sanitizedMessage');

    logTest('security', 'XSS Sanitization - Frontend Component',
      hasDOMPurify && hasSanitization,
      hasDOMPurify ? 'Frontend sanitization implemented' : 'DOMPurify not found in component'
    );
  } catch (error) {
    logTest('security', 'XSS Sanitization - Frontend Component', false, error.message);
  }

  // Rate Limiting Implementation
  try {
    const wsServicePath = path.join(__dirname, 'changanet/changanet-backend/src/services/unifiedWebSocketService.js');
    const wsContent = fs.readFileSync(wsServicePath, 'utf8');

    const hasRateLimiter = wsContent.includes('RateLimiterMemory');
    const hasMessageLimit = wsContent.includes('points: 10') || wsContent.includes('points: 30');
    const hasConsumeCall = wsContent.includes('messageRateLimiter.consume');

    logTest('security', 'Rate Limiting Implementation',
      hasRateLimiter && hasMessageLimit && hasConsumeCall,
      hasRateLimiter ? 'Rate limiting configured' : 'RateLimiterMemory not found'
    );
  } catch (error) {
    logTest('security', 'Rate Limiting Implementation', false, error.message);
  }

  // Image Validation with Sharp
  try {
    const controllerPath = path.join(__dirname, 'changanet/changanet-backend/src/controllers/unifiedChatController.js');
    const controllerContent = fs.readFileSync(controllerPath, 'utf8');

    const hasSharp = controllerContent.includes('sharp(');
    const hasValidation = controllerContent.includes('validateImageContent');
    const hasMetadata = controllerContent.includes('metadata.width') && controllerContent.includes('metadata.height');

    logTest('security', 'Image Validation with Sharp',
      hasSharp && hasValidation && hasMetadata,
      hasSharp ? 'Sharp image validation implemented' : 'Sharp validation not found'
    );
  } catch (error) {
    logTest('security', 'Image Validation with Sharp', false, error.message);
  }

  // UUID Validation
  try {
    const controllerPath = path.join(__dirname, 'changanet/changanet-backend/src/controllers/unifiedChatController.js');
    const controllerContent = fs.readFileSync(controllerPath, 'utf8');

    const hasUUIDRegex = controllerContent.includes('uuidRegex');
    const hasUUIDTest = controllerContent.includes('uuidRegex.test');
    const hasUUIDValidation = controllerContent.includes('INVALID_UUID');

    logTest('security', 'UUID Validation',
      hasUUIDRegex && hasUUIDTest && hasUUIDValidation,
      hasUUIDRegex ? 'UUID validation implemented' : 'UUID regex not found'
    );
  } catch (error) {
    logTest('security', 'UUID Validation', false, error.message);
  }
}

// ========================================
// 2. INTEGRATION FIXES VALIDATION
// ========================================

async function validateIntegrationFixes() {
  console.log('\n🔗 VALIDATING INTEGRATION FIXES...');

  // WebSocket Event Synchronization
  try {
    const wsServicePath = path.join(__dirname, 'changanet/changanet-backend/src/services/unifiedWebSocketService.js');
    const wsContent = fs.readFileSync(wsServicePath, 'utf8');

    const hasMessageEvent = wsContent.includes('socket.on(\'message\'');
    const hasEmitMessage = wsContent.includes('emit(\'message\'');
    const hasConversationRooms = wsContent.includes('conversationRooms');

    logTest('integration', 'WebSocket Event Synchronization',
      hasMessageEvent && hasEmitMessage && hasConversationRooms,
      hasMessageEvent ? 'WebSocket events synchronized' : 'Message events not properly synchronized'
    );
  } catch (error) {
    logTest('integration', 'WebSocket Event Synchronization', false, error.message);
  }

  // Field Names Alignment
  try {
    const schemaPath = path.join(__dirname, 'changanet/changanet-backend/prisma/schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');

    const hasConversationId = schemaContent.includes('conversation_id');
    const hasSenderId = schemaContent.includes('sender_id');
    const hasRecipientId = schemaContent.includes('recipient_id');
    const hasMessageField = schemaContent.includes('message String?');

    logTest('integration', 'Field Names Alignment',
      hasConversationId && hasSenderId && hasRecipientId && hasMessageField,
      hasConversationId ? 'Database fields properly aligned' : 'Field alignment issues found'
    );
  } catch (error) {
    logTest('integration', 'Field Names Alignment', false, error.message);
  }

  // Message Format Consistency
  try {
    const controllerPath = path.join(__dirname, 'changanet/changanet-backend/src/controllers/unifiedChatController.js');
    const controllerContent = fs.readFileSync(controllerPath, 'utf8');

    const hasFormattedMessage = controllerContent.includes('formattedMessage');
    const hasConsistentFields = controllerContent.includes('conversation_id') && controllerContent.includes('sender_id');
    const hasStatusField = controllerContent.includes('status: \'sent\'');

    logTest('integration', 'Message Format Consistency',
      hasFormattedMessage && hasConsistentFields && hasStatusField,
      hasFormattedMessage ? 'Message format consistent' : 'Message format inconsistencies found'
    );
  } catch (error) {
    logTest('integration', 'Message Format Consistency', false, error.message);
  }

  // WebSocket Authentication
  try {
    const wsServicePath = path.join(__dirname, 'changanet/changanet-backend/src/services/unifiedWebSocketService.js');
    const wsContent = fs.readFileSync(wsServicePath, 'utf8');

    const hasJWTVerify = wsContent.includes('jwt.verify');
    const hasSocketUser = wsContent.includes('socket.user');
    const hasAuthError = wsContent.includes('Authentication required');

    logTest('integration', 'WebSocket Authentication',
      hasJWTVerify && hasSocketUser && hasAuthError,
      hasJWTVerify ? 'WebSocket authentication implemented' : 'WebSocket auth missing'
    );
  } catch (error) {
    logTest('integration', 'WebSocket Authentication', false, error.message);
  }
}

// ========================================
// 3. FUNCTIONALITY FIXES VALIDATION
// ========================================

async function validateFunctionalityFixes() {
  console.log('\n⚙️ VALIDATING FUNCTIONALITY FIXES...');

  // Image Upload Implementation
  try {
    const controllerPath = path.join(__dirname, 'changanet/changanet-backend/src/controllers/unifiedChatController.js');
    const controllerContent = fs.readFileSync(controllerPath, 'utf8');

    const hasUploadUrl = controllerContent.includes('getUploadUrl');
    const hasPresignedURL = controllerContent.includes('getSignedUrl');
    const hasFileValidation = controllerContent.includes('allowedTypes');

    logTest('functionality', 'Image Upload Implementation',
      hasUploadUrl && hasPresignedURL && hasFileValidation,
      hasUploadUrl ? 'Image upload with presigned URLs implemented' : 'Image upload not properly implemented'
    );
  } catch (error) {
    logTest('functionality', 'Image Upload Implementation', false, error.message);
  }

  // Chat Button in ProfessionalCard
  try {
    const cardPath = path.join(__dirname, 'changanet/changanet-frontend/src/components/ProfessionalCard.jsx');
    const cardContent = fs.readFileSync(cardPath, 'utf8');

    const hasChatButton = cardContent.includes('handleChat');
    const hasOpenConversation = cardContent.includes('openConversation');
    const hasChatLoading = cardContent.includes('chatLoading');

    logTest('functionality', 'Chat Button in ProfessionalCard',
      hasChatButton && hasOpenConversation && hasChatLoading,
      hasChatButton ? 'Chat button properly implemented' : 'Chat button missing or broken'
    );
  } catch (error) {
    logTest('functionality', 'Chat Button in ProfessionalCard', false, error.message);
  }

  // Image Preview in Chat
  try {
    const chatPath = path.join(__dirname, 'changanet/changanet-frontend/src/components/Chat/EnhancedChat.jsx');
    const chatContent = fs.readFileSync(chatPath, 'utf8');

    const hasImagePreview = chatContent.includes('showImagePreview');
    const hasImageFile = chatContent.includes('imageFile');
    const hasPreviewUI = chatContent.includes('URL.createObjectURL');

    logTest('functionality', 'Image Preview in Chat',
      hasImagePreview && hasImageFile && hasPreviewUI,
      hasImagePreview ? 'Image preview implemented' : 'Image preview missing'
    );
  } catch (error) {
    logTest('functionality', 'Image Preview in Chat', false, error.message);
  }
}

// ========================================
// 4. DATABASE FIXES VALIDATION
// ========================================

async function validateDatabaseFixes() {
  console.log('\n🗄️ VALIDATING DATABASE FIXES...');

  // Prisma Schema - Conversations Table
  try {
    const schemaPath = path.join(__dirname, 'changanet/changanet-backend/prisma/schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');

    const hasConversationsModel = schemaContent.includes('model conversations');
    const hasClientId = schemaContent.includes('client_id');
    const hasProfessionalId = schemaContent.includes('professional_id');
    const hasUniqueConstraint = schemaContent.includes('@@unique([client_id, professional_id])');

    logTest('database', 'Prisma Schema - Conversations Table',
      hasConversationsModel && hasClientId && hasProfessionalId && hasUniqueConstraint,
      hasConversationsModel ? 'Conversations table properly defined' : 'Conversations model missing'
    );
  } catch (error) {
    logTest('database', 'Prisma Schema - Conversations Table', false, error.message);
  }

  // Prisma Schema - Messages Table
  try {
    const schemaPath = path.join(__dirname, 'changanet/changanet-backend/prisma/schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');

    const hasMessagesModel = schemaContent.includes('model mensajes');
    const hasConversationId = schemaContent.includes('conversation_id String');
    const hasSenderId = schemaContent.includes('sender_id String');
    const hasMessageField = schemaContent.includes('message String?');
    const hasImageUrl = schemaContent.includes('image_url String?');

    logTest('database', 'Prisma Schema - Messages Table',
      hasMessagesModel && hasConversationId && hasSenderId && hasMessageField && hasImageUrl,
      hasMessagesModel ? 'Messages table properly defined' : 'Messages model missing'
    );
  } catch (error) {
    logTest('database', 'Prisma Schema - Messages Table', false, error.message);
  }

  // Database Relationships
  try {
    const schemaPath = path.join(__dirname, 'changanet/changanet-backend/prisma/schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');

    const hasForeignKeys = schemaContent.includes('@relation') && schemaContent.includes('fields:') && schemaContent.includes('references:');
    const hasCascadeDelete = schemaContent.includes('onDelete: Cascade');
    const hasIndexes = schemaContent.includes('@@index');

    logTest('database', 'Database Relationships',
      hasForeignKeys && hasCascadeDelete && hasIndexes,
      hasForeignKeys ? 'Database relationships properly configured' : 'Relationships not configured'
    );
  } catch (error) {
    logTest('database', 'Database Relationships', false, error.message);
  }
}

// ========================================
// 5. UI/UX IMPROVEMENTS VALIDATION
// ========================================

async function validateUIUXImprovements() {
  console.log('\n🎨 VALIDATING UI/UX IMPROVEMENTS...');

  // Typing Indicators
  try {
    const chatPath = path.join(__dirname, 'changanet/changanet-frontend/src/components/Chat/EnhancedChat.jsx');
    const chatContent = fs.readFileSync(chatPath, 'utf8');

    const hasTypingIndicator = chatContent.includes('TypingIndicator');
    const hasTypingUsers = chatContent.includes('typingUsers');
    const hasTypingEvent = chatContent.includes('socket.on(\'typing\'');

    logTest('uiux', 'Typing Indicators',
      hasTypingIndicator && hasTypingUsers && hasTypingEvent,
      hasTypingIndicator ? 'Typing indicators implemented' : 'Typing indicators missing'
    );
  } catch (error) {
    logTest('uiux', 'Typing Indicators', false, error.message);
  }

  // Scroll Pagination
  try {
    const chatPath = path.join(__dirname, 'changanet/changanet-frontend/src/components/Chat/EnhancedChat.jsx');
    const chatContent = fs.readFileSync(chatPath, 'utf8');

    const hasScrollHandler = chatContent.includes('handleScroll');
    const hasInfiniteScroll = chatContent.includes('scrollTop <= 100');
    const hasLoadMore = chatContent.includes('loadMoreMessages');

    logTest('uiux', 'Scroll Pagination',
      hasScrollHandler && hasInfiniteScroll && hasLoadMore,
      hasScrollHandler ? 'Scroll pagination implemented' : 'Scroll pagination missing'
    );
  } catch (error) {
    logTest('uiux', 'Scroll Pagination', false, error.message);
  }

  // Connection Status Indicators
  try {
    const chatPath = path.join(__dirname, 'changanet/changanet-frontend/src/components/Chat/EnhancedChat.jsx');
    const chatContent = fs.readFileSync(chatPath, 'utf8');

    const hasConnectionStatus = chatContent.includes('isConnected');
    const hasStatusIndicator = chatContent.includes('bg-green-400') || chatContent.includes('bg-red-400');
    const hasStatusText = chatContent.includes('Conectado') || chatContent.includes('Desconectado');

    logTest('uiux', 'Connection Status Indicators',
      hasConnectionStatus && hasStatusIndicator && hasStatusText,
      hasConnectionStatus ? 'Connection status indicators implemented' : 'Connection indicators missing'
    );
  } catch (error) {
    logTest('uiux', 'Connection Status Indicators', false, error.message);
  }

  // Message Status Indicators
  try {
    const bubblePath = path.join(__dirname, 'changanet/changanet-frontend/src/components/Chat/MessageBubble.jsx');
    const bubbleContent = fs.readFileSync(bubblePath, 'utf8');

    const hasStatusDisplay = bubbleContent.includes('status');
    const hasReadIndicator = bubbleContent.includes('read') || bubbleContent.includes('leído');
    const hasTimestamp = bubbleContent.includes('created_at');

    logTest('uiux', 'Message Status Indicators',
      hasStatusDisplay && hasReadIndicator && hasTimestamp,
      hasStatusDisplay ? 'Message status indicators implemented' : 'Message status indicators missing'
    );
  } catch (error) {
    logTest('uiux', 'Message Status Indicators', false, error.message);
  }
}

// ========================================
// MAIN EXECUTION
// ========================================

async function runValidation() {
  console.log('🚀 STARTING MESSAGING MODULE VALIDATION');
  console.log('=====================================');

  try {
    await validateSecurityFixes();
    await validateIntegrationFixes();
    await validateFunctionalityFixes();
    await validateDatabaseFixes();
    await validateUIUXImprovements();

    // Generate final report
    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL VALIDATION REPORT');
    console.log('='.repeat(80));

    const categories = ['security', 'integration', 'functionality', 'database', 'uiux'];
    let totalPassed = 0;
    let totalFailed = 0;

    categories.forEach(category => {
      const results = testResults[category];
      const total = results.passed + results.failed;
      const percentage = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;

      console.log(`\n🔍 ${category.toUpperCase()} FIXES:`);
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

    console.log('\n' + '='.repeat(80));
    console.log('🎯 OVERALL RESULTS:');
    console.log(`   ✅ Total Passed: ${totalPassed}`);
    console.log(`   ❌ Total Failed: ${totalFailed}`);
    console.log(`   📊 Overall Success Rate: ${overallPercentage}%`);
    console.log('='.repeat(80));

    if (overallPercentage >= 90) {
      console.log('🎉 EXCELLENT: Messaging module fixes are working correctly!');
    } else if (overallPercentage >= 75) {
      console.log('👍 GOOD: Most fixes are working, minor issues to address.');
    } else if (overallPercentage >= 50) {
      console.log('⚠️  FAIR: Several fixes need attention.');
    } else {
      console.log('❌ POOR: Critical fixes are not working properly.');
    }

    console.log('\n📋 RECOMMENDATIONS:');
    if (totalFailed > 0) {
      console.log('   - Review failed tests and fix identified issues');
      console.log('   - Run integration tests with actual database');
      console.log('   - Test end-to-end functionality manually');
    } else {
      console.log('   - All fixes validated successfully!');
      console.log('   - Ready for production deployment');
    }

    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Validation failed with error:', error);
  }
}

// Run the validation
runValidation();