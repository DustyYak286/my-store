/**
 * Async Test Utilities
 * 
 * Utilities for handling async operations in React component tests
 * to prevent act() warnings and ensure proper test cleanup.
 */

import { act } from '@testing-library/react';

/**
 * Flush all pending async operations in React components
 * 
 * This drains both microtasks and macrotasks to ensure all
 * state updates and effects have completed before test cleanup.
 */
export async function flushAsync(): Promise<void> {
  await act(async () => {
    // Flush microtasks (Promises, queueMicrotask)
    await Promise.resolve();
    
    // Flush macrotasks (setTimeout, setInterval)
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

/**
 * Wait for async operations with a timeout
 * 
 * Useful for components with longer initialization periods
 */
export async function flushAsyncWithTimeout(timeoutMs: number = 100): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, timeoutMs));
  });
}