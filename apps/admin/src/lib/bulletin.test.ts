import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import {
  loadBulletin,
  createElection,
  registerVoter,
  issueCredential,
  type Bulletin,
  type Position,
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

describe('admin bulletin adapter', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('loadBulletin invokes load_bulletin and returns the result', async () => {
    const expected = emptyBulletin();
    invokeMock.mockResolvedValueOnce(expected);

    const result = await loadBulletin();

    expect(invokeMock).toHaveBeenCalledWith('load_bulletin');
    expect(result).toEqual(expected);
  });

  it('createElection invokes with the election fields and positions array', async () => {
    const updated = emptyBulletin();
    invokeMock.mockResolvedValueOnce(updated);
    const positions: Position[] = [
      { id: 'president', label: 'President', pick: 1 },
    ];

    const result = await createElection({
      name: 'Demo Election',
      opens: '2026-06-08 06:00',
      closes: '2026-06-08 18:00',
      positions,
    });

    expect(invokeMock).toHaveBeenCalledWith('create_election', {
      name: 'Demo Election',
      opens: '2026-06-08 06:00',
      closes: '2026-06-08 18:00',
      positions,
    });
    expect(result).toEqual(updated);
  });

  it('registerVoter invokes with camelCased args', async () => {
    const updated = emptyBulletin();
    invokeMock.mockResolvedValueOnce(updated);

    const result = await registerVoter({
      voterId: 'V-000001',
      email: 'voter1@wmsu.edu.ph',
      name: 'Demo Voter',
    });

    expect(invokeMock).toHaveBeenCalledWith('register_voter', {
      voterId: 'V-000001',
      email: 'voter1@wmsu.edu.ph',
      name: 'Demo Voter',
    });
    expect(result).toEqual(updated);
  });

  it('issueCredential invokes with voterId', async () => {
    const updated = emptyBulletin();
    invokeMock.mockResolvedValueOnce(updated);

    const result = await issueCredential({ voterId: 'V-000001' });

    expect(invokeMock).toHaveBeenCalledWith('issue_credential', {
      voterId: 'V-000001',
    });
    expect(result).toEqual(updated);
  });
});
