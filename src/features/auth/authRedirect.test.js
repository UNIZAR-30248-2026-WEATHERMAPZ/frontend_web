import { consumeAuthRedirect } from './authRedirect.js';

describe('consumeAuthRedirect', () => {
  const location = (hash) => ({ hash, pathname: '/', search: '?x=1' });

  it('returns the token and removes it from the address bar', () => {
    const history = { replaceState: jest.fn() };

    expect(consumeAuthRedirect(location('#authToken=abc.def'), history)).toEqual({
      token: 'abc.def',
    });
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/?x=1');
  });

  it('turns a Google error into a notice', () => {
    const history = { replaceState: jest.fn() };

    expect(consumeAuthRedirect(location('#authError=google'), history)).toEqual({
      notice: 'No se ha podido iniciar sesión con Google. Inténtalo de nuevo.',
    });
    expect(history.replaceState).toHaveBeenCalled();
  });

  it('leaves unrelated URLs untouched', () => {
    const history = { replaceState: jest.fn() };

    expect(consumeAuthRedirect(location('#mapa'), history)).toEqual({});
    expect(history.replaceState).not.toHaveBeenCalled();
  });
});
