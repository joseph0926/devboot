import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorLogger } from '../../../src/utils/error-logger';
import { BaseError } from '../../../src/errors/base.error';
import { SimpleLogicError } from '../../../src/errors/logic.error';
import { LogicErrorCodes } from '../../../src/types/error.type';

// Mock console methods
const mockConsole = {
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
};

vi.stubGlobal('console', mockConsole);

describe('ErrorLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.DEBUG;
  });

  describe('logError', () => {
    it('should log BaseError with default options', () => {
      const error = new SimpleLogicError(
        LogicErrorCodes.FILE_NOT_FOUND,
        'File not found',
        false,
        { file: 'test.txt' },
        'Check if the file exists'
      );

      ErrorLogger.logError(error);

      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('File not found'));
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('💡 Check if the file exists'));
    });

    it('should log BaseError without prefix', () => {
      const error = new SimpleLogicError(
        LogicErrorCodes.FILE_NOT_FOUND,
        'File not found',
        false
      );

      ErrorLogger.logError(error, { prefix: false });

      expect(mockConsole.error).toHaveBeenCalledWith('File not found');
    });

    it('should log BaseError without solution', () => {
      const error = new SimpleLogicError(
        LogicErrorCodes.FILE_NOT_FOUND,
        'File not found',
        false,
        { file: 'test.txt' },
        'Check if the file exists'
      );

      ErrorLogger.logError(error, { showSolution: false });

      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('File not found'));
      expect(mockConsole.log).not.toHaveBeenCalledWith(expect.stringContaining('💡'));
    });

    it('should show context in verbose mode', () => {
      const error = new SimpleLogicError(
        LogicErrorCodes.FILE_NOT_FOUND,
        'File not found',
        false,
        { file: 'test.txt', path: '/test/path' }
      );

      ErrorLogger.logError(error, { verbose: true, showContext: true });

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Debug info:'));
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('test.txt'));
    });

    it('should show context when DEBUG env is set', () => {
      process.env.DEBUG = '1';
      
      const error = new SimpleLogicError(
        LogicErrorCodes.FILE_NOT_FOUND,
        'File not found',
        false,
        { file: 'test.txt' }
      );

      ErrorLogger.logError(error, { showContext: true });

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Debug info:'));
    });

    it('should show stack trace in verbose mode', () => {
      const error = new SimpleLogicError(
        LogicErrorCodes.FILE_NOT_FOUND,
        'File not found',
        false
      );
      error.stack = 'Error stack trace...';

      ErrorLogger.logError(error, { verbose: true });

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Stack trace:'));
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Error stack trace...'));
    });

    it('should log generic Error', () => {
      const error = new Error('Generic error');

      ErrorLogger.logError(error);

      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('Generic error'));
    });

    it('should log generic Error with stack trace in verbose mode', () => {
      const error = new Error('Generic error');
      error.stack = 'Generic stack trace...';

      ErrorLogger.logError(error, { verbose: true });

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Stack trace:'));
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Generic stack trace...'));
    });

    it('should log unknown error', () => {
      const error = 'String error';

      ErrorLogger.logError(error);

      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('An unexpected error occurred'));
      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('String error'));
    });

    it('should log null/undefined error', () => {
      ErrorLogger.logError(null);

      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('An unexpected error occurred'));
      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('null'));
    });
  });

  describe('logWarning', () => {
    it('should log warning message', () => {
      ErrorLogger.logWarning('This is a warning');

      expect(mockConsole.warn).toHaveBeenCalledWith(expect.stringContaining('This is a warning'));
    });
  });

  describe('logInfo', () => {
    it('should log info message', () => {
      ErrorLogger.logInfo('This is info');

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('This is info'));
    });
  });

  describe('logErrorSummary', () => {
    it('should do nothing for empty errors array', () => {
      ErrorLogger.logErrorSummary([]);

      expect(mockConsole.error).not.toHaveBeenCalled();
    });

    it('should log single error summary', () => {
      const errors = [
        new SimpleLogicError(
          LogicErrorCodes.FILE_NOT_FOUND,
          'File not found',
          false,
          {},
          'Check the file path'
        ),
      ];

      ErrorLogger.logErrorSummary(errors);

      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('1 error occurred'));
      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('1. File not found'));
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('💡 Check the file path'));
    });

    it('should log multiple errors summary', () => {
      const errors = [
        new SimpleLogicError(LogicErrorCodes.FILE_NOT_FOUND, 'First error', false),
        new SimpleLogicError(LogicErrorCodes.FILE_READ_ERROR, 'Second error', false),
      ];

      ErrorLogger.logErrorSummary(errors);

      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('2 errors occurred'));
      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('1. First error'));
      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('2. Second error'));
    });

    it('should show solutions in error summary', () => {
      const errors = [
        new SimpleLogicError(
          LogicErrorCodes.FILE_NOT_FOUND,
          'File not found',
          false,
          {},
          'Check the file path'
        ),
        // BaseError without solution
        new BaseError('Base error', 'TEST_ERROR', {}),
      ];

      ErrorLogger.logErrorSummary(errors);

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('💡 Check the file path'));
      // Should not show solution for BaseError
      expect(mockConsole.log).not.toHaveBeenCalledWith(expect.stringContaining('Base error'));
    });
  });

  describe('logErrorWithProgress', () => {
    it('should log error with progress information', () => {
      const error = new SimpleLogicError(
        LogicErrorCodes.FILE_NOT_FOUND,
        'File not found',
        false
      );
      const progress = { current: 2, total: 5, item: 'processing file.txt' };

      ErrorLogger.logErrorWithProgress(error, progress);

      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('[2/5] processing file.txt'));
      expect(mockConsole.error).toHaveBeenCalledWith('File not found');
    });
  });
});