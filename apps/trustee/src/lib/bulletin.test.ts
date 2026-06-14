import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import {
  loadBulletin,
  saveBulletin,
  submitPartialDecryption,
  submitAllPartialDecryptions,
  type Bulletin,
} from './bulletin';

function emptyBulletin(): Bulletin {
  return {
    version: 1,
    election: null,
    voters: [],
    credentials: [],
    ballots: [],
    partial_decryptions: [],
    tally: null,
  };
}

describe('bulletin adapter', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('loadBulletin invokes the load_bulletin command and returns its result', async () => {
    const expected = emptyBulletin();
    invokeMock.mockResolvedValueOnce(expected);

    const result = await loadBulletin();

    expect(invokeMock).toHaveBeenCalledWith('load_bulletin');
    expect(result).toEqual(expected);
  });

  it('saveBulletin invokes save_bulletin with the bulletin payload', async () => {
    invokeMock.mockResolvedValueOnce(undefined);
    const b = emptyBulletin();

    await saveBulletin(b);

    expect(invokeMock).toHaveBeenCalledWith('save_bulletin', { bulletin: b });
  });

  it('submitPartialDecryption invokes with camelCased args', async () => {
    const updated = emptyBulletin();
    invokeMock.mockResolvedValueOnce(updated);

    const result = await submitPartialDecryption('t03', 17, 0);

    expect(invokeMock).toHaveBeenCalledWith('submit_partial_decryption', {
      trusteeId: 't03',
      secretShare: 17,
      ballotIndex: 0,
    });
    expect(result).toEqual(updated);
  });

  it('submitAllPartialDecryptions invokes with trusteeId and secretShare', async () => {
    const updated = emptyBulletin();
    invokeMock.mockResolvedValueOnce(updated);

    const result = await submitAllPartialDecryptions('t03', 17);

    expect(invokeMock).toHaveBeenCalledWith('submit_all_partial_decryptions', {
      trusteeId: 't03',
      secretShare: 17,
    });
    expect(result).toEqual(updated);
  });
});
