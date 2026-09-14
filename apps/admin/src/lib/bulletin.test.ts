import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  ApiError,
  getMe,
  login,
  logout,
  listRuns,
  getCapabilities,
  generateElection,
  checkPopulation,
  loadElectionSummary,
  runStatus,
  startCeremony,
  loadCeremony,
  publishTally,
  verifyRun,
  loadCorrectness,
  subscribeEvents,
  parseCsv,
  boardUrl,
  trailUrl,
  trusteeUrl,
  type ElectionConfig,
} from "./bulletin";

function res(status: number, body: unknown): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => (typeof body === "string" ? JSON.parse(body) : body),
    text: async () => text,
  } as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function lastCall(): [string, RequestInit | undefined] {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [
    string,
    RequestInit | undefined,
  ];
}

describe("session routes", () => {
  it("reads the session from /api/me", async () => {
    fetchMock.mockResolvedValue(res(200, { username: "ops", role: "admin" }));
    await expect(getMe()).resolves.toEqual({ username: "ops", role: "admin" });
    expect(lastCall()[0]).toBe("/api/me");
  });

  // A console without the auth routes answers /api/me from its catch-all 404.
  // That is "auth is off", not an error, so the app runs without a login.
  it("treats a 404 from /api/me as auth being off", async () => {
    fetchMock.mockResolvedValue(res(404, "404 page not found"));
    await expect(getMe()).resolves.toBeNull();
  });

  it("rejects with status 401 when there is no session", async () => {
    fetchMock.mockResolvedValue(res(401, { error: "login required" }));
    const err = await getMe().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect((err as ApiError).message).toBe("login required");
  });

  it("posts the credentials to /api/login", async () => {
    fetchMock.mockResolvedValue(res(204, ""));
    await login("ops", "hunter2");
    const [url, init] = lastCall();
    expect(url).toBe("/api/login");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      username: "ops",
      password: "hunter2",
    });
  });

  it("surfaces the login refusal text verbatim", async () => {
    fetchMock.mockResolvedValue(res(401, { error: "invalid credentials" }));
    await expect(login("ops", "nope")).rejects.toThrow("invalid credentials");
  });

  it("logs out with a POST", async () => {
    fetchMock.mockResolvedValue(res(204, ""));
    await logout();
    expect(lastCall()[0]).toBe("/api/logout");
    expect(lastCall()[1]?.method).toBe("POST");
  });
});

describe("election routes", () => {
  it("lists runs from /runs", async () => {
    fetchMock.mockResolvedValue(res(200, []));
    await listRuns();
    expect(lastCall()[0]).toBe("/runs");
  });

  it("reads capabilities", async () => {
    fetchMock.mockResolvedValue(res(200, { fabric: true, peer: "p:7051" }));
    await expect(getCapabilities()).resolves.toEqual({
      fabric: true,
      peer: "p:7051",
    });
    expect(lastCall()[0]).toBe("/api/capabilities");
  });

  it("posts the ElectionConfig to /generate and returns the run id", async () => {
    fetchMock.mockResolvedValue(res(202, { run_id: "demo-1" }));
    const config: ElectionConfig = {
      name: "Demo",
      trustees: [{ name: "A" }, { name: "B" }],
      threshold: 2,
      positions: 3,
      candidates: 4,
      senate_seats: 2,
      voters: 100,
      distribution: "uniform",
      mode: "offline",
    };
    await expect(generateElection(config)).resolves.toBe("demo-1");
    const [url, init] = lastCall();
    expect(url).toBe("/generate");
    expect(JSON.parse(String(init?.body))).toEqual(config);
  });

  // Validate(), the ladder gate and the disk guard all answer with plain-text
  // prose via http.Error; it must reach the form unchanged.
  it("surfaces a plain-text 400 verbatim", async () => {
    fetchMock.mockResolvedValue(res(400, "threshold must be 1..=2 (got 3)\n"));
    await expect(generateElection({} as ElectionConfig)).rejects.toMatchObject({
      status: 400,
      message: "threshold must be 1..=2 (got 3)",
    });
  });

  it("surfaces a JSON 403 error text verbatim", async () => {
    fetchMock.mockResolvedValue(res(403, { error: "admin role required" }));
    await expect(listRuns()).rejects.toMatchObject({
      status: 403,
      message: "admin role required",
    });
  });

  it("reads the validation gate report", async () => {
    fetchMock.mockResolvedValue(res(200, { pass: true, checks: [] }));
    await checkPopulation("demo-1");
    expect(lastCall()[0]).toBe("/api/check/demo-1");
  });

  it("reads the run's phase lock", async () => {
    fetchMock.mockResolvedValue(res(200, { run_id: "demo-1", busy: false }));
    await expect(runStatus("demo-1")).resolves.toEqual({
      run_id: "demo-1",
      busy: false,
    });
    expect(lastCall()[0]).toBe("/api/runs/demo-1/status");
  });

  it("parses election.csv, including a quoted name with a comma", async () => {
    fetchMock.mockResolvedValue(
      res(
        200,
        "election_id,election_name,trustees,threshold,positions,candidates,voters,num_ballots,num_partial_decryptions,ground_truth_total,distribution,mode,trustee_names,issuer_public_key,binding_context,dkg_sha256,tally_sha256,ballots_sha256\n" +
          'demo-1,"Mayor, 2026",3,2,3,4,100,300,36,300,uniform,offline,A; B; C,ab12,cd34,d1,t1,b1\n',
      ),
    );
    const s = await loadElectionSummary("demo-1");
    expect(lastCall()[0]).toBe("/export/demo-1/election.csv");
    expect(s.election_name).toBe("Mayor, 2026");
    expect(s.num_ballots).toBe(300);
    expect(s.num_partial_decryptions).toBe(36);
    expect(s.voters).toBe(100);
    expect(s.issuer_public_key).toBe("ab12");
  });

  it("starts the ceremony, reads it, and publishes", async () => {
    fetchMock.mockResolvedValue(res(202, { run_id: "demo-1" }));
    await startCeremony("demo-1");
    expect(lastCall()[0]).toBe("/ceremony/start");
    expect(JSON.parse(String(lastCall()[1]?.body))).toEqual({
      run_id: "demo-1",
    });

    fetchMock.mockResolvedValue(res(200, { election_id: "demo-1" }));
    await loadCeremony("demo-1");
    expect(lastCall()[0]).toBe("/api/ceremony/demo-1");

    fetchMock.mockResolvedValue(res(202, { run_id: "demo-1" }));
    await publishTally("demo-1");
    expect(lastCall()[0]).toBe("/ceremony/publish");
  });

  it("surfaces the below-threshold 409 verbatim", async () => {
    fetchMock.mockResolvedValue(
      res(409, "the tally needs 3 of 5 trustees; 2 have contributed so far\n"),
    );
    await expect(publishTally("demo-1")).rejects.toThrow(
      "the tally needs 3 of 5 trustees; 2 have contributed so far",
    );
  });

  it("verifies with a POST to /verify", async () => {
    fetchMock.mockResolvedValue(res(202, { run_id: "demo-1" }));
    await verifyRun("demo-1");
    expect(lastCall()[0]).toBe("/verify");
  });

  it("parses correctness.csv into typed rows", async () => {
    fetchMock.mockResolvedValue(
      res(
        200,
        "contest,ground_truth,decoded,E,pass,published_tally,recovered_point,aggregate_ciphertext,dkg_sha256,tally_sha256,ballots_sha256,source,ledger_matches_local\n" +
          "president/cand0,40,40,0,true,40,aa,bb,d1,t1,b1,local,true\n" +
          "president/cand1,60,59,1,false,60,aa,bb,d1,t1,b1,ledger,true\n",
      ),
    );
    const rows = await loadCorrectness("demo-1");
    expect(lastCall()[0]).toBe("/export/demo-1/correctness.csv");
    expect(rows).toEqual([
      {
        contest: "president/cand0",
        ground_truth: 40,
        decoded: 40,
        E: 0,
        pass: true,
        published_tally: 40,
        tally_sha256: "t1",
        source: "local",
        ledger_matches_local: "true",
      },
      {
        contest: "president/cand1",
        ground_truth: 60,
        decoded: 59,
        E: 1,
        pass: false,
        published_tally: 60,
        tally_sha256: "t1",
        source: "ledger",
        ledger_matches_local: "true",
      },
    ]);
  });
});

describe("helpers", () => {
  it("parses quoted CSV fields with escaped quotes", () => {
    expect(parseCsv('a,"b ""c"", d",e\n1,2,3\n')).toEqual([
      ["a", 'b "c", d', "e"],
      ["1", "2", "3"],
    ]);
  });

  it("builds links served by the same console", () => {
    expect(boardUrl("demo-1")).toBe("/board/?run=demo-1");
    expect(trailUrl("demo-1")).toBe("/trail/demo-1");
    expect(trusteeUrl("demo-1", "2")).toBe("/trustee/?run=demo-1&trustee=2");
  });

  it("subscribes to the run's event stream and closes it", () => {
    const close = vi.fn();
    let instance: { url: string; onmessage?: (m: { data: string }) => void } = {
      url: "",
    };
    vi.stubGlobal(
      "EventSource",
      class {
        url: string;
        onmessage?: (m: { data: string }) => void;
        constructor(url: string) {
          this.url = url;
          // eslint-disable-next-line @typescript-eslint/no-this-alias
          instance = this;
        }
        close = close;
      },
    );
    const seen: unknown[] = [];
    const stop = subscribeEvents("demo-1", (e) => seen.push(e));
    expect(instance.url).toBe("/events?run=demo-1");
    instance.onmessage?.({
      data: JSON.stringify({ phase: "generate", level: "done", msg: "ok" }),
    });
    instance.onmessage?.({ data: "not json" });
    expect(seen).toEqual([{ phase: "generate", level: "done", msg: "ok" }]);
    stop();
    expect(close).toHaveBeenCalled();
  });
});
