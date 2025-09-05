/**
 * Minimal Global Teardown
 * 
 * Production-grade approach: Each test suite manages its own resources.
 * This global teardown should only handle truly global concerns and 
 * provide diagnostic information if suites fail to clean up properly.
 */

export default async function globalTeardown() {
  console.log('🔍 Global Teardown: Checking for leaks...');

  try {
    // Diagnostic: Check for remaining open handles (should be none if suites cleaned up properly)
    if ((process as any)._getActiveHandles) {
      const activeHandles = (process as any)._getActiveHandles();
      if (activeHandles.length > 0) {
        console.warn('⚠️  LEAK DETECTED: Active handles found after all suites completed:');
        console.warn('    This suggests a test suite failed to clean up properly.');
        console.warn('    Handles:', activeHandles.map((h: any) => h.constructor.name));
        
        // Detailed logging for debugging
        activeHandles.forEach((handle: any, index: number) => {
          if (handle.constructor.name === 'TLSSocket') {
            console.warn(`  [${index}] TLSSocket - HTTP keep-alive connection not closed`);
          } else if (handle.constructor.name === 'Timeout') {
            console.warn(`  [${index}] Timeout - active timer: ${handle._idleTimeout}ms`);
          } else if (handle.constructor.name === 'ChildProcess') {
            console.warn(`  [${index}] ChildProcess - PID: ${handle.pid}`);
          } else {
            console.warn(`  [${index}] ${handle.constructor.name}`);
          }
        });
      } else {
        console.log('✅ No active handles detected - all suites cleaned up properly');
      }
    }

    // Minimal cleanup: Only truly global resources (if any)
    // Note: Each suite should handle its own resources in afterAll()
    
    // Force garbage collection if available (helps with final cleanup)
    if (global.gc) {
      global.gc();
      console.log('✅ Final garbage collection triggered');
    }

    console.log('✅ Global teardown complete');
    
  } catch (error) {
    console.error('❌ Error during global teardown:', error);
    // Don't throw - let tests complete even if global cleanup fails
  }
}