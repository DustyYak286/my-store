/**
 * Webhook Helpers Tests
 * 
 * Tests for webhook security and deduplication utilities
 */

import {
  isEventFresh,
  isDuplicateEvent,
  markEventProcessed,
  resetWebhookDedupStore,
  cleanupProcessedEvents,
} from './webhookHelpers';

describe('webhookHelpers', () => {
  beforeEach(() => {
    // Reset the deduplication store before each test
    resetWebhookDedupStore();
    
    // Reset timers
    jest.clearAllTimers();
  });

  afterEach(() => {
    resetWebhookDedupStore();
  });

  describe('isEventFresh', () => {
    beforeEach(() => {
      // Mock Date.now to return a consistent timestamp
      jest.spyOn(Date, 'now').mockReturnValue(1640995200000); // 2022-01-01 00:00:00 UTC
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return true for recent events', () => {
      // Event created 30 seconds ago
      const eventCreatedSeconds = Math.floor((1640995200000 - 30000) / 1000);
      const maxAgeMs = 60000; // 1 minute tolerance

      const result = isEventFresh(eventCreatedSeconds, maxAgeMs);

      expect(result).toBe(true);
    });

    it('should return false for old events', () => {
      // Event created 2 minutes ago
      const eventCreatedSeconds = Math.floor((1640995200000 - 120000) / 1000);
      const maxAgeMs = 60000; // 1 minute tolerance

      const result = isEventFresh(eventCreatedSeconds, maxAgeMs);

      expect(result).toBe(false);
    });

    it('should handle events exactly at the age limit', () => {
      // Event created exactly 60 seconds ago
      const eventCreatedSeconds = Math.floor((1640995200000 - 60000) / 1000);
      const maxAgeMs = 60000; // 1 minute tolerance

      const result = isEventFresh(eventCreatedSeconds, maxAgeMs);

      expect(result).toBe(true);
    });

    it('should handle events just past the age limit', () => {
      // Event created 60.1 seconds ago
      const eventCreatedSeconds = Math.floor((1640995200000 - 60100) / 1000);
      const maxAgeMs = 60000; // 1 minute tolerance

      const result = isEventFresh(eventCreatedSeconds, maxAgeMs);

      expect(result).toBe(false);
    });

    it('should handle future events (clock skew)', () => {
      // Event created 10 seconds in the future
      const eventCreatedSeconds = Math.floor((1640995200000 + 10000) / 1000);
      const maxAgeMs = 60000; // 1 minute tolerance

      const result = isEventFresh(eventCreatedSeconds, maxAgeMs);

      expect(result).toBe(true);
    });

    it('should work with different max age values', () => {
      const eventCreatedSeconds = Math.floor((1640995200000 - 300000) / 1000); // 5 minutes ago

      expect(isEventFresh(eventCreatedSeconds, 240000)).toBe(false); // 4 minutes tolerance
      expect(isEventFresh(eventCreatedSeconds, 300000)).toBe(true);  // 5 minutes tolerance
      expect(isEventFresh(eventCreatedSeconds, 360000)).toBe(true);  // 6 minutes tolerance
    });
  });

  describe('isDuplicateEvent and markEventProcessed', () => {
    it('should return false for unprocessed events', () => {
      const eventId = 'evt_test_123';

      const result = isDuplicateEvent(eventId);

      expect(result).toBe(false);
    });

    it('should return true after marking an event as processed', () => {
      const eventId = 'evt_test_123';

      markEventProcessed(eventId);
      const result = isDuplicateEvent(eventId);

      expect(result).toBe(true);
    });

    it('should handle multiple different events', () => {
      const eventId1 = 'evt_test_123';
      const eventId2 = 'evt_test_456';
      const eventId3 = 'evt_test_789';

      markEventProcessed(eventId1);
      markEventProcessed(eventId2);

      expect(isDuplicateEvent(eventId1)).toBe(true);
      expect(isDuplicateEvent(eventId2)).toBe(true);
      expect(isDuplicateEvent(eventId3)).toBe(false);
    });

    it('should track timestamps when marking events', () => {
      const mockNow = 1640995200000;
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      const eventId = 'evt_test_123';
      markEventProcessed(eventId);

      expect(isDuplicateEvent(eventId)).toBe(true);

      jest.restoreAllMocks();
    });

    it('should handle empty and special event IDs', () => {
      const specialIds = [
        '',
        ' ',
        'evt_',
        'evt_123_with_underscores',
        'evt-123-with-dashes',
        'evt.123.with.dots',
        'very_long_event_id_' + 'x'.repeat(100),
      ];

      specialIds.forEach(eventId => {
        expect(isDuplicateEvent(eventId)).toBe(false);
        markEventProcessed(eventId);
        expect(isDuplicateEvent(eventId)).toBe(true);
      });
    });
  });

  describe('resetWebhookDedupStore', () => {
    it('should clear all processed events', () => {
      const eventIds = ['evt_1', 'evt_2', 'evt_3'];

      // Mark multiple events as processed
      eventIds.forEach(markEventProcessed);
      eventIds.forEach(id => expect(isDuplicateEvent(id)).toBe(true));

      // Reset store
      resetWebhookDedupStore();

      // All events should now be considered new
      eventIds.forEach(id => expect(isDuplicateEvent(id)).toBe(false));
    });

    it('should allow marking events again after reset', () => {
      const eventId = 'evt_test_123';

      markEventProcessed(eventId);
      expect(isDuplicateEvent(eventId)).toBe(true);

      resetWebhookDedupStore();
      expect(isDuplicateEvent(eventId)).toBe(false);

      markEventProcessed(eventId);
      expect(isDuplicateEvent(eventId)).toBe(true);
    });
  });

  describe('deduplication store cleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should clean up old entries', () => {
      const mockNow = 1640995200000; // Base timestamp
      jest.spyOn(Date, 'now').mockImplementation(() => mockNow);

      // Mark an event as processed
      const eventId = 'evt_old_123';
      markEventProcessed(eventId);
      expect(isDuplicateEvent(eventId)).toBe(true);

      // Advance time by 15 minutes (past the 10-minute TTL)
      const futureTime = mockNow + (15 * 60 * 1000);
      jest.spyOn(Date, 'now').mockImplementation(() => futureTime);

      // Manually trigger cleanup with the future time
      cleanupProcessedEvents(futureTime);

      // The event should no longer be considered a duplicate
      expect(isDuplicateEvent(eventId)).toBe(false);

      jest.restoreAllMocks();
    });

    it('should keep recent entries during cleanup', () => {
      const mockNow = 1640995200000; // Base timestamp
      jest.spyOn(Date, 'now').mockImplementation(() => mockNow);

      // Mark an event as processed
      const eventId = 'evt_recent_123';
      markEventProcessed(eventId);
      expect(isDuplicateEvent(eventId)).toBe(true);

      // Advance time by 3 minutes (within the 10-minute TTL)
      const futureTime = mockNow + (3 * 60 * 1000);
      jest.spyOn(Date, 'now').mockImplementation(() => futureTime);

      // Manually trigger cleanup
      cleanupProcessedEvents(futureTime);

      // The event should still be considered a duplicate
      expect(isDuplicateEvent(eventId)).toBe(true);

      jest.restoreAllMocks();
    });

    it('should handle mixed old and recent entries', () => {
      const mockNow = 1640995200000;

      // First, simulate an old event being processed in the past
      const oldTime = mockNow - (12 * 60 * 1000); // 12 minutes ago
      jest.spyOn(Date, 'now').mockImplementation(() => oldTime);
      const oldEventId = 'evt_old_123';
      markEventProcessed(oldEventId);

      // Then simulate a recent event being processed now
      jest.spyOn(Date, 'now').mockImplementation(() => mockNow);
      const recentEventId = 'evt_recent_123';
      markEventProcessed(recentEventId);

      // Both should be duplicates initially
      expect(isDuplicateEvent(recentEventId)).toBe(true);
      expect(isDuplicateEvent(oldEventId)).toBe(true);

      // Advance time to 15 minutes from the original mockNow
      // This makes the old event 27 minutes old (12 + 15) and the recent event 15 minutes old
      const futureTime = mockNow + (15 * 60 * 1000);
      jest.spyOn(Date, 'now').mockImplementation(() => futureTime);

      // Manually trigger cleanup - should remove events older than 10 minutes
      cleanupProcessedEvents(futureTime);

      // Both events should be cleaned up as they're both older than 10 minutes
      expect(isDuplicateEvent(recentEventId)).toBe(false);
      expect(isDuplicateEvent(oldEventId)).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('integration scenarios', () => {
    it('should handle typical webhook processing flow', () => {
      const eventId = 'evt_payment_intent_123';
      const eventCreatedSeconds = Math.floor(Date.now() / 1000) - 30; // 30 seconds ago

      // First check: event should be fresh and not duplicate
      expect(isEventFresh(eventCreatedSeconds, 300000)).toBe(true); // 5 minutes tolerance
      expect(isDuplicateEvent(eventId)).toBe(false);

      // Process the event
      markEventProcessed(eventId);

      // Second check: event should still be fresh but now duplicate
      expect(isEventFresh(eventCreatedSeconds, 300000)).toBe(true);
      expect(isDuplicateEvent(eventId)).toBe(true);
    });

    it('should reject old duplicate events', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1640995200000);

      const eventId = 'evt_old_duplicate_123';
      const eventCreatedSeconds = Math.floor((1640995200000 - 600000) / 1000); // 10 minutes ago

      // Event is old and not yet processed
      expect(isEventFresh(eventCreatedSeconds, 300000)).toBe(false); // 5 minutes tolerance
      expect(isDuplicateEvent(eventId)).toBe(false);

      // Even if we mark it as processed, it's still too old
      markEventProcessed(eventId);
      expect(isEventFresh(eventCreatedSeconds, 300000)).toBe(false);
      expect(isDuplicateEvent(eventId)).toBe(true);

      jest.restoreAllMocks();
    });

    it('should handle rapid successive webhook calls', () => {
      const baseEventId = 'evt_rapid_';
      const numEvents = 100;

      // Simulate rapid webhook calls with same event ID
      for (let i = 0; i < numEvents; i++) {
        const eventId = baseEventId + '123'; // Same event ID

        if (i === 0) {
          // First occurrence should not be duplicate
          expect(isDuplicateEvent(eventId)).toBe(false);
          markEventProcessed(eventId);
        } else {
          // All subsequent occurrences should be duplicates
          expect(isDuplicateEvent(eventId)).toBe(true);
        }
      }
    });
  });
});