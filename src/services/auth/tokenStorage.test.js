import { clearStoredToken, getStoredToken, storeToken } from './tokenStorage.js';

describe('tokenStorage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  it('stores, reads and clears the session token', () => {
    expect(getStoredToken()).toBeNull();
    storeToken('abc');
    expect(getStoredToken()).toBe('abc');
    clearStoredToken();
    expect(getStoredToken()).toBeNull();
  });

  it('keeps working when the browser blocks storage', () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    jest.spyOn(window.Storage.prototype, 'getItem').mockImplementation(blocked);
    jest.spyOn(window.Storage.prototype, 'setItem').mockImplementation(blocked);
    jest.spyOn(window.Storage.prototype, 'removeItem').mockImplementation(blocked);

    expect(() => storeToken('abc')).not.toThrow();
    expect(getStoredToken()).toBeNull();
    expect(() => clearStoredToken()).not.toThrow();
  });
});
