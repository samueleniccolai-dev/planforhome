import { endSeries } from '../client';

describe('endSeries', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps 409 not_recurring to changed, like not_open', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'not_recurring' }),
    });
    expect(await endSeries('f', 't', { mutationId: 'm' })).toEqual({ status: 'changed' });
  });
});
