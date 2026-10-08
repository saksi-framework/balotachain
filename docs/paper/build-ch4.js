// Builds chapter-4-draft.docx from ch4-data.json and ch4-figures/*.png.
// Run from the repo root after `python docs/paper/ch4-data.py`:
//   NODE_PATH="$(npm root -g)" node docs/paper/build-ch4.js      (needs `npm i -g docx`)
// Style follows Chapters I-III of BalotaChain_Final_Paper.pdf: US Letter, 1.5 in left margin,
// Arial 12 at 1.5 spacing with a 0.5 in first-line indent, bold 14 chapter title, bold 12 section
// headings without numbers, italic 11 captions (tables above, figures below), 9 pt tables.
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, AlignmentType,
  WidthType, ShadingType, BorderStyle, HeadingLevel, LevelFormat, VerticalAlign,
} = require("docx");

const HERE = __dirname;
const d = JSON.parse(fs.readFileSync(path.join(HERE, "ch4-data.json"), "utf8"));
const OUT = path.join(HERE, "chapter-4-draft.docx");
const TEXT_W = 12240 - 2160 - 1440; // 8640 DXA

// ---------- data helpers ----------
const tier = (n) => d.tiers.find((t) => t.name === n);
const A = (n) => (tier(n) || {}).auto;
const med = (n, k) => { const a = A(n); return a && a[k] ? a[k].median : null; };
const fmt = (x, dp = 0) => x == null || Number.isNaN(x) ? "–"
  : Number(x).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const pct = (a, b) => ((a - b) / b) * 100;
const sec = (n) => d.security_runs.find((s) => s.name === n);
const measuredTiers = d.tiers.filter((t) => t.auto && t.mode === "onchain");
const PEND = (n) => (tier(n) && tier(n).pending) || "";

// ---------- paragraph helpers ----------
const FONT = "Arial";
const runs = (parts, base = {}) => (Array.isArray(parts) ? parts : [parts]).map((p) => {
  if (typeof p !== "string") return new TextRun({ font: FONT, ...base, ...p });
  // any [PENDING — ...] marker is printed bold on a yellow highlight so it cannot be missed
  const out = [];
  p.split(/(\[PENDING[^\]]*\])/).forEach((s) => {
    if (!s) return;
    out.push(s.startsWith("[PENDING")
      ? new TextRun({ text: s, font: FONT, bold: true, highlight: "yellow", ...base })
      : new TextRun({ text: s, font: FONT, ...base }));
  });
  return out;
}).flat();

const body = [];
const P = (parts, o = {}) => body.push(new Paragraph({
  children: runs(parts, { size: 24 }), alignment: AlignmentType.JUSTIFIED,
  spacing: { line: 360, after: 0 }, indent: o.noIndent ? undefined : { firstLine: 720 },
}));
const H1 = (t) => body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs(t),
  spacing: { before: 240, after: 120, line: 360 } }));
const H2 = (t) => body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs(t),
  spacing: { before: 120, after: 60, line: 360 } }));
const LI = (parts) => body.push(new Paragraph({ numbering: { reference: "num", level: 0 },
  children: runs(parts, { size: 24 }), alignment: AlignmentType.JUSTIFIED, spacing: { line: 360 } }));
let tableNo = 0, figNo = 0;
const caption = (kind, t) => new Paragraph({ alignment: AlignmentType.CENTER, keepNext: kind === "Table",
  spacing: { before: 240, after: 120 }, children: runs(`${kind} 4.${kind === "Table" ? ++tableNo : ++figNo}. ${t}`, { italics: true, size: 22 }) });
const note = (t) => new Paragraph({ spacing: { before: 60, after: 240 },
  children: runs(t, { italics: true, size: 18 }) });

const border = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border };
const cell = (t, w, o = {}) => new TableCell({
  width: { size: w, type: WidthType.DXA }, borders, columnSpan: o.span,
  verticalAlign: VerticalAlign.CENTER,
  shading: o.head ? { type: ShadingType.CLEAR, color: "auto", fill: "E7E6E6" } : undefined,
  margins: { top: 40, bottom: 40, left: 80, right: 80 },
  children: [new Paragraph({ alignment: o.align || AlignmentType.LEFT,
    children: runs(String(t), { size: 18, bold: !!o.head }) })],
});
// rows: arrays of cells; a row given as {pending: text, first: [..]} spans the remaining columns
function TABLE(title, head, rows, weights, src) {
  const tot = weights.reduce((a, b) => a + b, 0);
  const w = weights.map((x) => Math.floor((x / tot) * TEXT_W));
  w[w.length - 1] += TEXT_W - w.reduce((a, b) => a + b, 0);
  const tr = rows.map((r) => {
    if (r.pending !== undefined) {
      const first = r.first.map((c, i) => cell(c, w[i]));
      const rest = w.slice(r.first.length).reduce((a, b) => a + b, 0);
      return new TableRow({ children: [...first, cell(r.pending, rest, { span: w.length - r.first.length })] });
    }
    return new TableRow({ children: r.map((c, i) => cell(c, w[i])) });
  });
  body.push(caption("Table", title));
  body.push(new Table({ width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: w,
    rows: [new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, w[i], { head: true })) }), ...tr] }));
  body.push(note(`Source: ${src}`));
}
function FIGURE(file, title, src) {
  const png = fs.readFileSync(path.join(HERE, "ch4-figures", file));
  // figures are drawn at 5.2 x 2.9 in; place at 6 in wide
  body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240 }, keepNext: true,
    children: [new ImageRun({ type: "png", data: png, transformation: { width: 576, height: 321 } })] }));
  body.push(caption("Figure", title));
  body.push(note(`Source: ${src}`));
}
const camp = (n) => (A(n) ? A(n).campaign : "");
const srcTiers = (names) => names.filter((n) => A(n)).map((n) => `${n} ${camp(n)}`).join("; ");
const BR = `branch ${d.build.evidence_branch}, docs/desktop-runs/2026-09-30-<tier>/`;

// =====================================================================================
// CHAPTER IV
// =====================================================================================
body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 },
  children: runs("CHAPTER IV", { bold: true, size: 28 }) }));
body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 },
  children: runs("RESULTS AND DISCUSSION", { bold: true, size: 28 }) }));

const onchainDone = measuredTiers.map((t) => t.name);
P(`This chapter presents the results of the evaluation defined in Chapter III and discusses them against the three research questions. Correctness (Research Question 1) is reported first, by the six criteria (a) to (f); integrity, privacy, and security (Research Question 2) follow, by testing scenario and adversary class; performance (Research Question 3) is reported per tier on the measures of Table 3.7 and compared with published systems. A section on findings about the measuring instrument itself precedes the summary. Every figure in this chapter is taken from the run files exported by the campaign console, and the source of each table is given beneath it. Results that were still being measured when this draft was prepared are marked as pending in place.`);

// ------------------------------------------------------------------ 4.1
H1("Test Tiers and Environment");
P(`All runs reported here used one build of the system: the Saksi framework and the campaign console at commit ${d.build.saksi_commit.slice(0, 7)}, with the same compiled generator binary in every run. The runs took place on the benchmarking desktop declared in Table 3.12. Table 4.1 records the environment as executed, which completes the fields that Table 3.12 left to be recorded at execution.`);
TABLE("Benchmarking environment as executed.", ["Item", "Specification"],
  d.environment.rows, [1, 3], d.environment.source + ".");
P(`Every election used ${d.election_config.text}. Each attempt at a tier began with a network reset, which brought the Fabric network back with a fresh channel and an empty ledger, followed by a preflight check of the host, the network, the disk, and the validation ladder. Before any tier larger than one thousand voters could start, the console required a validation ladder for the same commit: the complete protocol, run offline at 1, 10, 100, and 1,000 voters with three positions, had to decode every contest with E = 0. The ladder for this build passed at all four steps, and the race-enabled test suite of the campaign console's fault, resume, and campaign paths (61 tests) also passed on this build (validation report of 29 September 2026). ${d.small_items.ci_sast}`);
P(`Table 4.2 gives the evaluation matrix of Table 3.5 as it was executed. The repetition counts differ from the ten measured repetitions after two warm-ups stated in Chapter III: the 50,000-voter tiers used five measured repetitions, and the plan for the larger tiers is three measured repetitions after one warm-up at 483,000 voters and one to three measured runs above it, because a single repetition at those sizes occupies the machine for hours. The multi-position tiers from 483,000 to 3,524,078 voters are run offline, through generation and verification without the blockchain, with one on-chain multi-position run at 3,524,078 voters. These departures are recorded as amendments to Chapter III. A tier was rerun once from a fresh network when its measured repetitions were flagged as contended, and the rerun stood whatever its flags; superseded attempts are kept with the evidence.`);
TABLE("Evaluation matrix as executed.",
  ["Tier", "Voters × positions", "Mode", "Warm-ups + measured", "Failed", "Standing campaign"],
  d.tiers.map((t) => {
    const first = [t.name, `${fmt(t.voters)} × ${t.positions}`, t.mode === "onchain" ? "on-chain" : "offline"];
    if (!t.auto) return { first, pending: `${t.planned} planned. ${t.pending}` };
    const a = t.auto;
    return [...first, `${a.warmups} + ${a.measured}`, fmt(a.runs_failed.median), `${a.campaign}${t.note ? ` (${t.note})` : ""}`];
  }), [1.1, 1.3, 0.9, 1.1, 0.7, 3],
  `campaign.json and summary.csv of each tier export (${BR}); docs/desktop-runs/2026-09-30-ch4-study.md; row plan in the saksi console runbook, section 10.4, and docs/plans/2026-10-01-ch4-runs-and-chapter.md.`);

// ------------------------------------------------------------------ 4.2 RQ1
H1("Correctness of the Framework (Research Question 1)");
P(`Research Question 1 asked to what extent the framework operates correctly as an election system at multiple scales, by six criteria. Correctness was checked on every repetition, warm-ups included, because a warm-up is still a complete election. After the tally was published, the independent verifier audited each election twice: once over the console's local copy of the record and once over the ballots read back from the ledger. Each audit decoded every contest and compared it with the ground truth seeded at generation, and the two audits were compared with each other (the ledger-matches-local check: the same nullifier set and the same aggregate ciphertext per contest).`);
const secRow = (s) => [`${s.name} security run`, "1", fmt(s.auto.contests * 2), fmt(s.auto.E_max), s.auto.all_pass ? "Yes" : "No",
  s.auto.ledger_matches_local ? "Yes" : "No", fmt(s.auto.dropped), s.auto.verify];
TABLE("Correctness results per tier, all repetitions including warm-ups.",
  ["Tier", "Elections audited", "Contest rows (local + ledger)", "Largest E", "Every contest passes", "Ledger matches local", "Ballots dropped", "Verifier verdict"],
  [...d.tiers.map((t) => {
    if (!t.auto) return { first: [t.name], pending: t.pending };
    const c = t.auto.correctness;
    return [t.name, fmt(c.runs), fmt(c.contest_rows), fmt(c.E_max), c.all_pass ? "Yes" : "No",
      c.ledger_matches_local ? "Yes" : "No", fmt(c.dropped_total), t.auto.verify_overall_pass ? "pass" : "fail"];
  }), ...d.security_runs.filter((s) => s.auto).map(secRow),
  ["SP-10K T3 (peer restart)", "1", fmt(d.t3.contests * 2), fmt(d.t3.E_max), "Yes", "Yes", "0 after resume", "pass"]],
  [1.6, 0.9, 1.1, 0.7, 0.9, 0.9, 0.9, 0.9],
  `correctness.csv, perf.csv and journal.ndjson of every run in each tier export (${BR}); security runs ${d.security_runs.map((s) => s.run).join(", ")}; T3 run ${d.t3.run}.`);

P(`Criterion (a) held wherever it was measured: the announced tally equalled the ground truth, with E = 0, on every contest of every election from 1,000 to 50,000 voters, in both ballot configurations. Table 4.4 reproduces the accuracy form of Appendix C for the first measured repetition of the largest multi-position tier completed so far. The counts decoded by the verifier equal the ground truth on all twelve contests.`);
{
  const s = A("MP-50K").accuracy_sample;
  TABLE("Accuracy and integrity recording form, MP-50K, first measured repetition.",
    ["Position", "Candidate", "Decrypted count", "Ground-truth count", "Absolute difference"],
    s.rows.map((r) => [r[0].split("/")[0], r[0].split("/")[1], fmt(r[2]), fmt(r[1]), fmt(Math.abs(r[2] - r[1]))]),
    [1.4, 1, 1, 1, 1], `correctness.csv (source = local) of run ${s.run}, campaign ${camp("MP-50K")}.`);
}
P(`Table 4.5 answers each criterion. Criteria (b) and (c) were tested by the security runs described under Research Question 2: in each of the two runs, all eight mounted attacks were refused by the gate declared for them, including the double vote (a reused nullifier), which the chaincode refused with the reason "nullifier already spent … (double vote)". Criterion (d) was met in the sense that every accepted ballot was on the ledger and in the tally: no run dropped a ballot, the verifier's completeness check passed, and the ledger-matches-local check held on every ledger row. The node-restart run (T3) tested the same criterion under a fault and ended with all 10,000 ballots on the chain exactly once. Criterion (f) was met on every run: the verifier's overall verdict was pass with no failed check, which requires every ballot's validity proofs, every trustee's decryption proof, and the tally signatures to verify.`);
P(`Criterion (e) was met in part. The verifier reproduced every tally from the ballots it read back from the ledger, and that audit used only public data. The second experiment named in Chapter III, a verifier on a separate machine given only a copy of the public election record, had not yet been run. ${d.small_items.verifier_separate_machine} Chapter III also stated that decrypted counts are validated against the ElectionGuard test vectors [14]. The vectors that the framework's test suite uses check that the tally follows the same semantics as ElectionGuard; they do not establish conformance with the ElectionGuard specification, and no claim of conformance is made here.`);
const s10 = sec("SP-10K").auto, s1 = sec("MP-1K") && sec("MP-1K").auto;
TABLE("Research Question 1: results by criterion.", ["Criterion", "Evidence", "Result"], [
  ["(a) Announced tally equals ground truth", "E per contest, verifier over local and ledger records", `Met at every completed tier (${onchainDone.join(", ")}); larger tiers ${["SP-483K", "SP-1M", "SP-1.92M"].map(PEND).join(" ")}`],
  ["(b) Invalid ballots rejected", "Security runs: tampered proof, corrupted bytes, self-issued credential, overvote (live on-chain); tampered key-generation transcript and partial decryption (verifier)", `Met: ${s10.summary.rejected} of ${s10.summary.attempted} (SP-10K)${s1 ? ` and ${s1.summary.rejected} of ${s1.summary.attempted} (MP-1K)` : ""} rejected at the declared gate`],
  ["(c) Duplicate votes rejected", "reused-nullifier submitted live mid-election in both security runs", "Met: refused by the chaincode nullifier gate each time"],
  ["(d) All accepted ballots in the tally", "Dropped ballots, stream completeness, ledger-matches-local; T3 reconcile", `Met: 0 dropped; ledger matches local on every ledger row; T3 reconciled ${fmt(d.t3.reconcile_chain_count)} of ${fmt(d.t3.voters)}, ${d.t3.missing} missing`],
  ["(e) Independently verifiable", "Verifier over the ballots read back from the ledger", `Met on the ledger read-back. ${d.small_items.verifier_separate_machine}`],
  ["(f) All proofs verify", "Verifier overall verdict and failed checks", "Met: overall pass, no failed check, on every run"],
], [1.4, 2.4, 2.4], `Tables 4.3 and 4.6; negative-tests.csv of runs ${d.security_runs.map((s) => s.run).join(" and ")}; ${d.t3.source}.`);

// ------------------------------------------------------------------ 4.3 RQ2
H1("Integrity, Privacy, and Security (Research Question 2)");
P(`Research Question 2 asked what integrity, privacy, and security properties the system demonstrates under specified threat conditions. The attacks were mounted by the campaign console during a live election. The console paused the election at four stages (after key generation, halfway through the ballot window, after closing, and during the decryption ceremony), mounted the attacks defined for that stage, and resumed. Attacks during the ballot window were real submissions to the chaincode on the running network. Attacks that cannot be expressed as one submission, such as a dropped ballot, were mounted on a copy of the record and scored by the verifier. One security run was made on the single-position 10,000-voter network and one on the multi-position 1,000-voter network, each after that tier's measured campaign. Neither run's throughput is used for Research Question 3, because the pauses and attacks perturb timing.`);
H2("Security Run Verdicts");
{
  const v10 = Object.fromEntries(s10.verdicts.map((v) => [v.scenario, v]));
  const v1 = s1 ? Object.fromEntries(s1.verdicts.map((v) => [v.scenario, v])) : {};
  const order = ["tamper-dkg-transcript", "tamper-ballot-proof", "reused-nullifier", "corrupted-ballot-bytes", "self-issued-credential", "overvote", "dropped-ballot", "reordered-ballots", "tamper-partial-decryption"];
  TABLE("Attack scenarios mounted during the security runs.",
    ["Scenario", "Stage", "Mount", "Declared gate", "Observed gate", "SP-10K", "MP-1K"],
    order.map((k) => { const v = v10[k]; return [k, v.stage, v.verdict === "SKIPPED" ? "not mounted" : v.live === "true" ? "live on-chain" : "simulated, verifier",
      v.gate_expected || "none", (v.gate_observed || "none").split(";")[0], v.verdict, v1[k] ? v1[k].verdict : "[PENDING — MP-1K security run]"]; }),
    [2, 0.9, 1.2, 1.3, 1.3, 0.8, 0.8],
    `negative-tests.csv of runs ${d.security_runs.map((s) => s.run).join(" and ")}; docs/desktop-runs/2026-09-30-sp-10k-security.md.`);
}
P(`In both runs eight scenarios passed and one was skipped. Every pass was a refusal by the gate declared for that scenario, and the rejection rate was ${s10.summary.rejected} of ${s10.summary.attempted} in each run. Five of the eight were live submissions refused by the chaincode, which recorded its own reason for each: the validity-proof equation failed, the nullifier was already spent, the ballot bytes could not be decoded, the credential issuer was not the one bound to the election, and the selection proof did not match its transcript. The other three were mounted on a copy of the record and caught by the verifier: an altered key-generation commitment (not a valid group element), a dropped ballot (the committed stream held one ballot fewer than the header declared), and an altered partial-decryption proof (the Chaum-Pedersen check failed). The rate is a count of single attempts, one per scenario per run, not a sampled rate.`);
P(`The skipped scenario, reordered ballots, is a gap and not a pass. Neither the chaincode nor the stateless verifier checks the order of ballots, so there was no gate to test. Because the tally is a homomorphic sum, reordering cannot change the result, but it is not detected. In the multi-position run, each voter's three ballot records carried three different per-position nullifiers and all 3,000 records were admitted, while a reused nullifier was refused. This is the per-position enforcement that scenario T7 requires. The part of T7 in which the verifier reads the ballot stream while submissions continue was not exercised: the verifier ran after the election closed.`);
H2("Negative Test Catalogue");
P(`Chapter III listed fourteen negative test cases. Table 4.7 shows how each was covered. Eight were exercised in the security runs, live or through the verifier. Four of the remaining six have a named chaincode unit test in the source at this build, but no log of that test suite at this build had been archived when this draft was prepared. The altered transaction and the submission from outside the channel's membership service are defended by Fabric itself, and neither the console nor the chaincode tests mount them; they were not exercised in this study.`);
TABLE("Coverage of the negative test catalogue.", ["Case", "Guarding gate or check", "Exercised in the study runs", "Chaincode unit test (source)"],
  d.negative_catalog.rows, [1.6, 1.4, 2.4, 1.8], `${d.negative_catalog.source}. ${d.negative_catalog.test_log_pending}`);
H2("Adversary Classes");
TABLE("Security evaluation form: outcome per adversary class.", ["Adversary class", "Attack exercised", "Outcome"], [
  ["Malicious voter", "Double vote, malformed ballot, overvote, self-issued credential (live)", "Rejected by the nullifier, decode, selection and issuer gates; logged with the gate's reason"],
  ["Compromised client", "Substituted validity proof (live)", "Rejected by the CDS gate. Key exposure was not tested; the client holds no key material by design"],
  ["Malicious trustees (up to two)", "Altered Chaum-Pedersen proof on a partial decryption (simulated)", "Not checked on-chain (presence only); detected by the verifier's Chaum-Pedersen check. Sub-threshold decryption was not mounted (see Privacy)"],
  ["Network adversary", "Replay of a spent nullifier (live, as reused-nullifier)", "Replay rejected. Interception was not tested; the console serves plain HTTP, a stated limit"],
  ["Ledger administrator", "Dropped ballot and reordered ballots (simulated); altered key-generation commitment (simulated)", "Drop and alteration detected by the verifier; reordering not detected and without effect on the tally; front-running not prevented (stated limit)"],
  ["External attacker", "Forged identity (self-issued credential, live)", "Rejected by the issuer gate. Submission from outside the channel membership was not tested"],
], [1.3, 2.2, 2.7], `Tables 4.6 and 4.7; threat model of Table 3.9.`);
H2("Network Interruption and Recovery (T3)");
{
  const t = d.t3;
  P(`Scenario T3 was run once on the single-position 10,000-voter network, right after the security run. The peer ${t.fault.split(" ")[0]} was stopped when the ballot window reached ${t.fault.split("at ballot index ")[1]}, kept down for 20 s as planned, and restarted, and the run was then resumed and finished. Table 4.9 summarizes the record.`);
  TABLE("Node restart under load (T3), SP-10K.", ["Measure", "Value"], [
    ["Peer down time (measured)", `${fmt(t.down_ms / 1000, 1)} s`],
    ["Additional time until the connection was ready", `${fmt(t.ready_after_ms / 1000, 1)} s`],
    ["Ballots on the chain at the stop / counted committed by the driver", `${fmt(t.chain_at_fault)} / ${fmt(t.driver_committed_at_fault)}`],
    ["Ballots on the chain when the resume began", fmt(t.on_chain_at_resume)],
    ["Ballots submitted by the resume / committed / dropped / replays", `${fmt(t.resumed)} / ${fmt(t.resumed_committed)} / ${t.resumed_dropped} / ${t.replayed}`],
    ["Reconcile: ballots on the chain against expected", `${fmt(t.reconcile_chain_count)} of ${fmt(t.voters)}, ${t.missing} missing`],
    ["Chain walk (previous-hash linkage)", `PASS over ${t.chain_walk_blocks} linked blocks, ${fmt(t.chain_walk_sampled)} receipts sampled`],
    ["Tally error E", `${t.E_max} on all ${t.contests} contests, local and ledger`],
  ], [3, 2], t.source + ".");
  P(`No accepted ballot was lost and the tally was exact, so the T3 pass criterion of Table 3.7 (zero ballot loss after recovery) was met. The chain kept committing ballots that were already in flight at the stop, and the resume submitted only the ballots the chain did not hold. Two qualifications apply. First, because the load generator ran closed loop, every ballot after the fault point failed within about a second of the stop. The count of 6,000 ballots the driver recorded as dropped is therefore the rest of the window, not the loss over a 20-second outage; measuring outage-window loss needs a fixed send rate. Second, the test covered one peer, one outage length, and one point in the window. The orderer was not stopped, and with a single orderer the study cannot demonstrate orderer crash tolerance.`);
}
H2("Privacy");
{
  const sp = s10.partials_per_trustee, mp = s1 ? s1.partials_per_trustee : null;
  P(`Privacy was assessed by the three checks of Chapter III. Their results are recorded in Table 4.10.`);
  TABLE("Privacy evaluation form.", ["Check", "Method", "Result"], [
    ["Unlinkability", "Linkage join over a tier export: the adversary holds the public record and the registration list and outputs a voter-ballot pairing; success is compared with 1/N", d.small_items.linkage_join],
    ["Ballot secrecy", "Inspection of the tally path in the run records", `Held: each trustee submitted one partial decryption per contest (${sp} for the 4-contest SP-10K election${mp ? `, ${mp} for the 12-contest MP-1K election` : ""}), on the aggregate ciphertext only; no ballot-level decryption occurs`],
    ["Sub-threshold resistance", "Decryption attempted with fewer than three shares", `Not mounted in the study runs. The chaincode refuses a tally below threshold (unit test TestPublishTallyRejectsBelowThreshold); every ceremony published with ${s10.publish_signers} of 5 signers at threshold ${s10.threshold}. ${d.negative_catalog.test_log_pending}`],
  ], [1.2, 2.4, 2.6], `ceremony journal events (stage.ceremony.trustee.start, stage.ceremony.publish.start) of runs ${d.security_runs.map((s) => s.run).join(" and ")}; manuscript amendment 10.`);
  P(`Two limits bound what these checks show. First, the key-generation and registration ceremonies were simulated: the generator process produced every trustee share and every credential. A secrecy result therefore holds against every party except that process, and blind issuance across real parties was not exercised. Second, the study build (${d.build.saksi_commit.slice(0, 7)}) draws every trustee's key-generation polynomial at random from the operating system's generator. That makes it eligible for secrecy claims, which runs generated before commit 1812139 were not, because their election keys could be derived from the public source. Linkage across a voter's positions through timing or submission order was not analysed.`);
}
H2("Mapping to Philippine Electoral and Data Privacy Law");
TABLE("Simulated adversary classes, Philippine legal provisions, and observed outcomes.", ["Simulated adversary (threat)", "Corresponding provision (Table 3.10)", "Observed in this study"], [
  ["Malicious voter: double voting", "BP 881, Sec. 261; penalties under Sec. 264", "Refused live by the nullifier gate in both security runs"],
  ["Malicious voter: malformed ballot", "BP 881, Sec. 261(j); RA 9369, Sec. 35", "Refused live by the decode, CDS and selection gates"],
  ["Sub-threshold trustees: corrupt decryption", "RA 9369, Sec. 35(a)", "Altered decryption proof detected by the verifier; sub-threshold decryption not mounted"],
  ["Malicious administrator: manipulate manifest", "BP 881, Sec. 261(j); RA 9369, Sec. 35(a)", "Manifest edit not mounted; altered key-generation commitment detected by the verifier"],
  ["Malicious bulletin-board node: drop or reorder", "RA 9369, Sec. 35(a)", "Drop detected; reordering not detected (no effect on the tally)"],
  ["Network adversary: interception or replay", "RA 9369, Sec. 35; RA 10173, Sec. 29", "Replay refused; interception not tested (plain HTTP)"],
  ["Privacy adversary: linkage or secrecy", "RA 10173, Secs. 25, 28, 29", `Aggregate-only decryption held; linkage ${d.small_items.linkage_join}`],
], [2, 2, 2.4], `Table 3.10; Tables 4.6, 4.7 and 4.10. As in Chapter III, no claim of legal validity, compliance, or certification is made.`);
H2("Election Return Approval and Audit Trail");
P(`The decrypted tally, the system's analogue of an election return, was approved by the threshold ceremony in every run: trustees 1, 2, and 3 of the five each submitted their partial decryptions, and the tally was published with ${s10.publish_signers} signers at threshold ${s10.threshold}. The chaincode checks the trustee signatures at publication. The verifier then established from the public record that the signed totals equal the decrypted aggregate of the committed ballots, and it found no discrepancy in any run. The ceremony was simulated (all shares held by the generator process), so the separation of trust between trustees was not exercised.`);
P(`The audit trail consisted of the ledger and the per-run records kept off the chain: the journal of every stage and attack, the performance export, the correctness record, and the negative-test record. Every figure in this chapter was recomputed from these records. The verifier's ledger audit ended "ok" on every run, and the append-only chain walk passed where it ran (T3: ${d.t3.chain_walk_blocks} linked blocks).`);
H2("Limits of the Security Results");
P(`The results above show resistance to the defined scenarios under the stated threat model. They are not a general claim that the system is secure. The limits stated in the Scope section apply, and several were observed directly. The chaincode checks only the shape of a key-generation transcript and the presence of a partial-decryption proof; both were caught by the verifier and not on-chain. The chaincode performs no caller authorization, so a channel member could front-run a genuine transcript or partial decryption; the console does not mount that attack. The deployment ran both organizations and a single Raft orderer on one machine, and the console served plain HTTP. Implementation-level testing (input validation, static analysis, and dependency scanning) is reported separately. ${d.small_items.ci_sast}`);

// ------------------------------------------------------------------ 4.4 RQ3
H1("Performance (Research Question 3)");
P(`Research Question 3 asked what performance the system shows across election sizes representing Philippine electoral scales, and how this compares with existing systems on the same platform. Throughput is committed ballot records per second over the submission window (committed TPS). Latency is the client-observed time from submission to commit for each record. A multi-position voter contributes three records. The load generator kept 128 records in flight and sent the next as soon as one committed (closed loop). Every figure is the median over the measured repetitions, as the summary export computes it (the lower middle value when n is even). Failed repetitions would have been excluded and reported as a failure rate; none failed.`);
H2("Latency and Throughput per Tier");
TABLE("Latency and throughput per tier, median over measured repetitions.",
  ["Tier", "n", "Committed TPS (min–max)", "p50 ms", "p95 ms", "p99 ms", "Driver ceiling TPS", "Failure rate"],
  d.tiers.filter((t) => t.mode === "onchain").map((t) => {
    if (!t.auto) return { first: [t.name], pending: t.pending };
    const a = t.auto;
    return [t.name, fmt(a.committed_tps.n), `${fmt(a.committed_tps.median, 1)} (${fmt(a.committed_tps.min, 1)}–${fmt(a.committed_tps.p99, 1)})`,
      fmt(a.latency_p50_ms.median, 1), fmt(a.latency_p95_ms.median, 1), fmt(a.latency_p99_ms.median, 1),
      fmt(a.driver_ceiling_tps.median, 1), fmt(a.failure_rate.median)];
  }), [1, 0.5, 1.8, 0.8, 0.8, 0.8, 1.1, 0.8],
  `summary.csv of each tier export (${srcTiers(onchainDone)}); ${BR}. The maximum is summary.csv's p99 column, which at n ≤ 10 is the largest value.`);
P(`Throughput fell as the tiers grew. The single-position median went from ${fmt(med("SP-1K", "committed_tps"), 1)} TPS at 1,000 voters to ${fmt(med("SP-10K", "committed_tps"), 1)} at 10,000 and ${fmt(med("SP-50K", "committed_tps"), 1)} at 50,000. The multi-position median went from ${fmt(med("MP-1K", "committed_tps"), 1)} to ${fmt(med("MP-10K", "committed_tps"), 1)} and ${fmt(med("MP-50K", "committed_tps"), 1)}. Over the same range the p99 latency rose from ${fmt(med("MP-1K", "latency_p99_ms"), 0)}–${fmt(med("SP-1K", "latency_p99_ms"), 0)} ms to ${fmt(med("MP-50K", "latency_p99_ms"), 0)} ms, and the p50 from about ${fmt(med("SP-1K", "latency_p50_ms"), 0)} ms to ${fmt(med("MP-50K", "latency_p50_ms"), 0)} ms. Figures 4.1 and 4.2 plot both. The fall is discussed with the instrument findings below. The median, rather than the mean, is the figure to quote at 10,000 voters and above: a single multi-second stall moved the mean of a tier by hundreds of milliseconds while leaving the median unaffected.`);
FIGURE("fig-4-1-tps.png", "Committed throughput against election size, single- and multi-position, on-chain.", `ch4-data.json (tiers[].auto.committed_tps.median), from the summary.csv files of Table 4.12.`);
FIGURE("fig-4-2-p99.png", "p99 submit-to-commit latency against election size, on-chain.", `ch4-data.json (tiers[].auto.latency_p99_ms.median), from the summary.csv files of Table 4.12.`);
P(`The rows for 483,000 voters and above are pending. ${PEND("SP-483K")} ${PEND("SP-1M")} ${PEND("SP-1.92M")} ${PEND("SP-3.5M")} ${PEND("MP-3.5M on-chain")}`);
H2("Saturation and Peak Burst (T2 and T8)");
P(`The closed-loop repetitions measure the throughput the network sustains while it is always busy, but they do not locate a plateau. Scenario T2 calls for load at increasing send rates until saturation, and T8 for a worst-case arrival burst. Both were planned on the 483,000-voter network after its measured repetitions: a rate sweep from ${d.sweep_burst.plan}. ${d.sweep_burst.pending}`);
H2("Stage Timers and Threshold-Decryption Time");
P(`Table 4.13 gives the stage timers. Generation times are CPU time summed across the generator's threads (CPU-seconds), so they exceed wall time and are not divided by it. Verification is wall time on 16 threads. Aggregation measures point addition only, and is not comparable with any aggregation figure from earlier builds. Threshold-decryption time is reported in two parts. The in-process part is Lagrange recombination of the partial decryptions (combine) plus discrete-logarithm recovery of the counts (decode). The on-chain part is each trustee's submission of its partial decryptions.`);
TABLE("Stage timers, median over measured repetitions.",
  ["Tier", "Generation wall s", "Generation CPU s", "Proof generation CPU s", "Verification s (16 threads)", "Aggregate ms", "Combine ms", "Decode ms", "Submission window s"],
  d.tiers.map((t) => {
    if (!t.auto) return { first: [t.name], pending: t.pending };
    const a = t.auto, m = (k, s = 1) => a[k] ? a[k].median / s : null;
    return [t.name, fmt(m("gen_wall_ms", 1000), 1), fmt(m("gen_cpu_ms", 1000), 1), fmt(m("proof_gen_cpu_ms", 1000), 1),
      fmt(m("proof_verify_inproc_ms", 1000), 2), fmt(m("aggregate_inproc_ms")), fmt(m("combine_inproc_ms")), fmt(m("decrypt_inproc_ms")),
      a.submit_window_ms ? fmt(m("submit_window_ms", 1000), 1) : "–"];
  }), [1.1, 0.9, 0.9, 1, 1, 0.8, 0.8, 0.7, 0.9],
  `summary.csv of each tier export (${BR}); timer definitions in manuscript amendment 2.2.`);
{
  const tr = (s) => s.trustee_submit_ms.map((x) => fmt(x / 1000, 1)).join(", ");
  P(`The in-process part of threshold decryption was small at every completed tier: combine and decode together took ${fmt(med("MP-50K", "combine_inproc_ms") + med("MP-50K", "decrypt_inproc_ms"))} ms at MP-50K. It does not touch individual ballots; the decode part grows with the size of the counts to be recovered. Submitting the partial decryptions dominated. In the SP-10K security run each of the three trustees submitted ${s10.partials_per_trustee} partials in ${tr(s10)} s${s1 ? `, and in the MP-1K security run ${s1.partials_per_trustee} partials in ${tr(s1)} s` : ""}. That is about ${fmt(s10.trustee_submit_ms[0] / s10.partials_per_trustee / 1000, 2)} s per partial, close to the orderer's 2-second batch timeout. This suggests that each partial waited for a block to be cut; the study did not test that explanation. Verification grew with the number of records: ${fmt(med("SP-50K", "proof_verify_inproc_ms") / 1000, 1)} s for 50,000 records and ${fmt(med("MP-50K", "proof_verify_inproc_ms") / 1000, 1)} s for 150,000.`);
}
H2("Resource Consumption");
const rng = (k) => { const v = measuredTiers.map((t) => t.auto[k] && t.auto[k].median).filter((x) => x != null); return `${fmt(Math.min(...v), 0)}–${fmt(Math.max(...v), 0)}`; };
TABLE("Peak CPU and memory per tier, median over measured repetitions.",
  ["Tier", "Peer CPU %", "Orderer CPU %", "Client CPU %", "Peer memory MB", "Orderer memory MB", "Client memory MB"],
  d.tiers.filter((t) => t.mode === "onchain").map((t) => {
    if (!t.auto) return { first: [t.name], pending: t.pending };
    const a = t.auto, m = (k) => a[k] ? fmt(a[k].median, 1) : "not sampled";
    return [t.name, m("peak_cpu_pct_peer"), m("peak_cpu_pct_orderer"), m("peak_cpu_pct_client"), m("peak_mem_mb_peer"), m("peak_mem_mb_orderer"), m("peak_mem_mb_client")];
  }), [1, 1, 1, 1, 1, 1, 1],
  `summary.csv of each tier export (${BR}). CPU is percent of one core, of 1,600 % available.`);
P(`The docker-stats sampler recorded every 5 seconds, so it did not sample the 1,000-voter windows, which lasted only a few seconds; those cells are empty rather than zero. From 10,000 voters up, the peer peaked at ${rng("peak_cpu_pct_peer")} % of one core and the orderer at ${rng("peak_cpu_pct_orderer")} %, together under a third of the 1,600 % available, while throughput fell. The limit on this configuration was therefore not processor capacity. Orderer memory grew with the tier, to a median peak of ${fmt(med("MP-50K", "peak_mem_mb_orderer"), 0)} MB at MP-50K. Disk consumption was not measured for these tiers: the per-run ledger-growth column was empty, because the peer volume was not wired to the instrument. From the 483,000-voter tier on, the ledger size is measured with a directory-size read of the peer volume after each run. ${d.small_items.disk} Network utilization was not reported. All containers shared one host, so their traffic never left the machine, and a network figure would describe the virtual bridge rather than a deployment. This is stated as a limit.`);
H2("Candidate-Count Check");
{
  const c = d.candidates.auto, pts = c.points, f = c.fits;
  P(`Chapter III fixes four candidates per position, but Philippine ballots list more. To see how the per-record cost depends on the candidate count, the multi-position 1,000-voter tier was run with 10 and with 28 candidates per position (two warm-ups and five measured repetitions each) and compared with the four-candidate campaign. Each candidate adds one encrypted slot with its own validity proof to every record. Table 4.15 gives the per-record figures, and Figure 4.3 plots them with a least-squares line.`);
  TABLE("Per-record cost against candidates per position, MP-1K (3,000 records per election).",
    ["Candidates", "Campaign", "Generation CPU ms", "Proof generation CPU ms", "Verification ms (16 threads)", "Submission window ms", "p50 latency ms", "Committed TPS"],
    [...pts.map((p) => [p.candidates, p.campaign, fmt(p.gen_cpu_ms_per_record, 2), fmt(p.proof_gen_cpu_ms_per_record, 2), fmt(p.verify_ms_per_record, 3), fmt(p.submit_ms_per_record, 2), fmt(p.latency_p50_ms, 1), fmt(p.committed_tps, 1)]),
      ["Fit: fixed + per candidate", "", `${fmt(f.gen_cpu_ms_per_record.intercept, 2)} + ${fmt(f.gen_cpu_ms_per_record.slope, 3)}k`, `${fmt(f.proof_gen_cpu_ms_per_record.intercept, 2)} + ${fmt(f.proof_gen_cpu_ms_per_record.slope, 3)}k`, `${fmt(f.verify_ms_per_record.intercept, 3)} + ${fmt(f.verify_ms_per_record.slope, 4)}k`, `${fmt(f.submit_ms_per_record.intercept, 2)} + ${fmt(f.submit_ms_per_record.slope, 3)}k`, `${fmt(f.latency_p50_ms.intercept, 1)} + ${fmt(f.latency_p50_ms.slope, 2)}k`, ""]],
    [0.9, 2.1, 1, 1, 1, 1, 0.9, 0.9],
    `summary.csv of campaigns ${pts.map((p) => p.campaign).join(", ")} (the first from ${BR.replace("<tier>", "mp-1k")}; the others from the Night 1 exports in WSL ~/ch4/night1/exports/); medians divided by 3,000 records; fit by ordinary least squares over the three points (ch4-data.json candidates.auto.fits).`);
  P(`Per-record time grew almost linearly with the candidate count, with a fixed per-record part. Generation CPU fitted ${fmt(f.gen_cpu_ms_per_record.intercept, 2)} ms plus ${fmt(f.gen_cpu_ms_per_record.slope, 2)} ms per candidate (R² = ${fmt(f.gen_cpu_ms_per_record.r2, 4)}). Most of the per-candidate part was proof generation (${fmt(f.proof_gen_cpu_ms_per_record.slope, 2)} ms per candidate), and the fixed part corresponds to work that every record carries whatever the ballot, such as its credential and nullifier. Submission time per record fitted ${fmt(f.submit_ms_per_record.intercept, 2)} ms plus ${fmt(f.submit_ms_per_record.slope, 3)} ms per candidate (R² = ${fmt(f.submit_ms_per_record.r2, 3)}). Here the fixed part dominates; the per-candidate part is consistent with the chaincode verifying one validity proof per slot. Committed TPS fell from ${fmt(pts[0].committed_tps, 1)} to ${fmt(pts[pts.length - 1].committed_tps, 1)} as the candidates went from ${pts[0].candidates} to ${pts[pts.length - 1].candidates}. With three points the fit shows the trend; it is not a validated model. The 10- and 28-candidate campaigns were flagged for host CPU above 25 % on some measured repetitions (a web browser was running on the host), and each had used its one rerun. The four-candidate campaign ran a night earlier and was itself flagged on host CPU on ${pts[0].contended_host} of its measured repetitions. Their throughput figures are therefore less certain than their CPU-time figures. CPU time counts the generator's own work, whatever else the host is running.`);
  FIGURE("fig-4-3-candidates.png", "Per-record time against candidates per position, MP-1K, with least-squares lines.", `ch4-data.json (candidates.auto), from the summary.csv files of Table 4.15.`);
}
H2("Election-Day Arrival Rate");
P(`Chapter III stated that sustained throughput below the arrival rate of a ten-hour voting window would be reported as a scaling limit. The console's own scaling verdict could not settle this. It withholds a verdict whenever committed TPS is close to the load generator's own ceiling (128 records in flight divided by the median latency), and in closed loop that is the normal state, so the verdict is inconclusive by construction. It read "inconclusive" on ${measuredTiers.reduce((s, t) => s + (t.auto.scaling_limit_counts.inconclusive || 0), 0)} of the ${measuredTiers.reduce((s, t) => s + Object.values(t.auto.scaling_limit_counts).reduce((a, b) => a + b, 0), 0)} measured repetitions. The remaining ${measuredTiers.reduce((s, t) => s + (t.auto.scaling_limit_counts.false || 0), 0)} read "false" on repetitions whose throughput dipped away from the ceiling. The measured TPS is therefore compared directly with the election-day arrival rate, voters divided by 36,000 seconds. The comparison is made in ballot records, so the multi-position rate is three times the voter rate (Table 4.16).`);
TABLE("Committed throughput against the ten-hour arrival rate.",
  ["Tier", "Voters", "Arrival, voters/s", "Arrival, records/s", "Committed TPS (median)", "Margin"],
  d.tiers.filter((t) => t.mode === "onchain" || t.name.startsWith("MP-3.5M")).filter((t) => !(t.mode === "offline")).map((t) => {
    const av = t.voters / 36000, ar = av * t.positions;
    const tps = t.auto ? t.auto.committed_tps.median : null;
    return [t.name, fmt(t.voters), fmt(av, 2), fmt(ar, 2), tps ? fmt(tps, 1) : t.pending, tps ? `${fmt(tps / ar, 0)}×` : "–"];
  }), [1.2, 1, 1, 1, 1.4, 0.8],
  `arrival rule from Chapter III (Performance) and the saksi console (run.end arrival_tps = voters / 36,000 s); TPS from Table 4.12.`);
P(`At every completed tier the margin was large, because the arrival rate of a small electorate is small. The margins that matter are those of the capstones: ${fmt(3524078 / 36000, 1)} records per second for single-position SP-3.5M and ${fmt(3524078 * 3 / 36000, 1)} for MP-3.5M on-chain. The lowest median measured so far, ${fmt(med("MP-50K", "committed_tps"), 1)} TPS at MP-50K, is above both. Since throughput fell with scale, however, the capstone margins cannot be read off the small tiers; they wait for their own runs. ${PEND("SP-3.5M")} ${PEND("MP-3.5M on-chain")}`);
H2("Cost Model and Capstones");
P(`A cost model, fitted on the earlier measurements of rows 2 to 4 at build ef663d1, predicted the machine time of each larger tier before it ran. Table 4.17 sets its predictions beside the actual times as they land. The model was not refitted on the study build, and the study build ran slower than the build the model was fitted on (see Instrument Findings), so the error column tests the model and the build difference together.`);
TABLE("Predicted and actual hours per run, rows 5 to 9.", ["Tier", "Predicted h per run", "Actual h per run", "Error"],
  Object.entries(d.cost_model.predicted_h_per_run).map(([k, v]) => {
    const t = d.tiers.find((x) => x.name === k || `${x.name} on-chain` === k || x.name === k.replace(" on-chain", " on-chain"));
    const act = t && t.auto ? t.auto.wall_h_per_run_median : null;
    return [k, fmt(v, 3), act ? fmt(act, 3) : (t ? t.pending : "–"), act ? `${fmt(pct(act, v), 1)} %` : "–"];
  }), [1.6, 1, 1.6, 0.8],
  `${d.cost_model.source}; actual time is first to last journal timestamp of each measured run (ch4-data.json tiers[].auto.wall_h_per_run_median).`);
P(`Scope committed the study to both capstone attempts and to reporting either outcome, completion or a measured scaling limit, as a primary finding. The single-position capstones are run on-chain. The multi-position capstone at 3,524,078 voters is run once on-chain, and the multi-position tiers from 483,000 to 1,921,917 voters offline. The on-chain multi-position runs at those three sizes, listed in Table 3.5, are not attempted: at the measured rates each would hold the machine for many hours per repetition. ${PEND("SP-1.92M")} ${PEND("SP-3.5M")} ${PEND("MP-3.5M on-chain")} ${PEND("MP-483K offline")}`);
H2("Comparison with Published Systems");
{
  const r = d.references;
  TABLE("Comparison with published evaluations.", ["System", "Scale and workload", "Throughput", "Latency", "Hardware"], [
    ["Galal, El Reheem, and Guirguis [18]", `${fmt(r.r18.voters)} voters, single race of four candidates, Hyperledger Fabric`, `≈ ${r.r18.tps} TPS`, `≈ ${r.r18.s_per_vote} s per vote`, "Different from this study"],
    ["BalotaChain SP-50K (this study)", "50,000 voters, one position, four candidates, Fabric 2.5.15", `${fmt(med("SP-50K", "committed_tps"), 1)} TPS (median)`, `p50 ${fmt(med("SP-50K", "latency_p50_ms"), 0)} ms, p99 ${fmt(med("SP-50K", "latency_p99_ms"), 0)} ms`, "Table 4.1"],
    ["BalotaChain SP-1M (this study)", "1,000,000 voters, one position", PEND("SP-1M"), PEND("SP-1M"), "Table 4.1"],
    ["Fabric 2.5 benchmark [24]", "Fixed-asset workload, one million assets, commodity servers", `≈ ${fmt(r.r24.tps)} TPS peak`, "–", "Different from this study"],
    ["ElGamal homomorphic tally on Fabric [26]", "Closest prior encrypted-tally evaluation", `≈ ${r.r26.tps} TPS peak`, "–", "Different from this study"],
  ], [1.7, 2.1, 1.1, 1.2, 1], `${r.source}; Table 4.12.`);
  P(`At the 50,000-voter tier used for the direct comparison, the single-position configuration committed ${fmt(med("SP-50K", "committed_tps"), 1)} ballots per second, against the ≈ ${r.r18.tps} TPS reported by [18] at the same scale and ballot shape. That is about ${fmt(med("SP-50K", "committed_tps") / r.r18.tps, 0)} times higher. The median submit-to-commit latency was ${fmt(med("SP-50K", "latency_p50_ms"), 0)} ms against ≈ ${r.r18.s_per_vote} s per vote. The measured throughput also lies between the two reference points of Chapter III, above the ≈ ${r.r26.tps} TPS of [26] and below the ≈ ${fmt(r.r24.tps)} TPS of [24], as expected for a workload that verifies proofs in the chaincode. None of these is a controlled comparison. The systems ran on different hardware and network layouts. [18]'s per-vote time may not measure the same interval as submit-to-commit latency. BalotaChain's figures come from one machine that hosted all nodes and the load generator. The comparison with [18]'s projection beyond one million voters waits for the SP-1M tier. ${PEND("SP-1M")}`);
}

// ------------------------------------------------------------------ 4.5 instrument findings
H1("Findings About the Instrument");
P(`Four findings concern the measuring instrument and the conditions of measurement rather than the system's properties. They qualify the performance results above and are reported so that the figures are read correctly.`);
H2("Throughput Falls with Scale");
{
  const b = d.baseline_ef663d1.tps;
  P(`The fall in throughput from 1,000 to 50,000 voters (Table 4.12) was large and consistent across tiers. Each attempt started on an empty ledger and ran its two warm-ups first, and from 10,000 voters up the warm-ups were faster than the measured median in six of seven campaigns. This points to ledger growth within a campaign as a cause, but within the measured repetitions a clear decline appeared in only one campaign, so a within-campaign effect is suggested and not established.`);
  const names = Object.keys(b);
  TABLE("Committed throughput on the study build against the earlier build ef663d1.", ["Tier", "ef663d1 TPS", `${d.build.saksi_commit.slice(0, 7)} TPS`, "Difference"],
    names.map((n) => [n, fmt(b[n], 2), fmt(med(n, "committed_tps"), 2), `${fmt(pct(med(n, "committed_tps"), b[n]), 1)} %`]),
    [1, 1, 1, 1], `${d.baseline_ef663d1.source}; Table 4.12.`);
  const diffs = names.map((n) => -pct(med(n, "committed_tps"), b[n]));
  P(`The study build was ${fmt(Math.min(...diffs), 0)} to ${fmt(Math.max(...diffs), 0)} % slower than build ef663d1, the build on which the cost model was fitted, on the same six tiers and the same machine. The gap widened with scale. The builds differ in several changes, including the random key-generation dealers, and the study did not isolate the cause. An A/B comparison of the two builds on one network is pending. Until it is run, the two sets of figures should not be pooled, and all figures in this chapter come from the study build alone.`);
}
H2("The Contention Rule Counts the Run's Own Load");
{
  const c = d.contention_totals;
  P(`The console marked a repetition as contended when either of its two host samples showed Windows host CPU above 25 % or a WSL guest one-minute load average above 4.0 (a quarter of 16 threads). The guest load average includes the run's own generation and verification, sampled seconds after they finish. As a result, all ${c.flagged_10k_up} measured repetitions of the four standing tiers from 10,000 voters up were flagged, every one on guest load (${c.guest_load1_range}, rising with the tier). Host CPU flagged only one of them, at ${c.highest_host_10k_up} %. Across the six tiers, ${c.host_samples_over} of ${c.host_samples_total} host samples on measured repetitions exceeded 25 %, ${c.host_over_at_1k} of them at 1,000 voters, where a busy desktop is the likely source. The guest half of the rule cannot tell self-load from outside load, and it sent three tiers back for reruns that no host contention justified. For the Night 1 runs, the rerun rule was therefore applied on host CPU alone, and a guest flag was recorded as self-load. "Contended" is not cited as evidence of interference in this chapter unless the host sample supports it.`);
}
H2("In-Network Stalls");
TABLE("Measured repetitions with multi-second stalls.", ["Tier", "Campaign", "Repetition", "Committed TPS", "p99 ms", "Longest checkpoint gap s", "Host CPU start / end %"],
  d.stalls.rows, [0.8, 2.2, 0.8, 0.9, 0.8, 1, 1.1], d.stalls.source + ".");
P(`Five measured repetitions, two of them in a superseded attempt, stalled for several seconds: the gap between progress checkpoints, normally 1 to 3 s, reached 4.8 to 10.6 s. Their p99 rose to between 0.7 and 2.9 s while the host CPU samples read 1.9 to 18.2 %. Two warm-ups stalled as well (${d.stalls.warmups}). The p50 of each stalled repetition was unaffected, so most records committed normally and the pause caught the tail. The cause lies inside the Fabric and Docker stack, not in host load, but it was not identified: no peer or orderer logs were kept for those windows. From Night 1 on, the peer and orderer logs are saved after every run.`);
H2("Build Difference and Candidate Count");
P(`The 9 to 28 % gap to the earlier build and the candidate-count dependence both bear on how the figures carry over. The first means that a throughput figure is specific to a build as well as to the hardware, which the Scope section already states for hardware. The second means that the four-candidate figures describe a small ballot. A Philippine ballot with more candidates per position costs more per record, in close to linear proportion, and commits fewer records per second on the same network.`);

// ------------------------------------------------------------------ 4.6 summary
H1("Summary of Findings");
TABLE("Findings against the objectives.", ["Objective", "Finding", "Status"], [
  ["1. Implement the framework and verify correct end-to-end operation across scales", `E = 0, no dropped ballot, ledger matching the local record, and a passing verifier on every election at ${onchainDone.join(", ")}, warm-ups included; also under a peer restart`, `Met to 50,000 voters. Larger tiers ${["SP-483K", "SP-1M", "SP-1.92M", "SP-3.5M", "MP-3.5M on-chain"].map(PEND).join(" ")} ${PEND("MP-483K offline")}. Separate-machine verifier pending`],
  ["2. Evaluate integrity, privacy and security under the threat model", `8 of 8 mounted attacks refused at the declared gate in each security run (5 live on-chain); reordering undetected (a gap); aggregate-only decryption held; ceremony simulated`, `Met for the mounted scenarios. ${d.small_items.linkage_join} ${d.small_items.ci_sast}`],
  ["3. Characterize performance and compare with a baseline on the same platform", `${fmt(med("MP-50K", "committed_tps"), 0)}–${fmt(med("MP-1K", "committed_tps"), 0)} TPS, falling with scale; p99 ${fmt(med("MP-1K", "latency_p99_ms"), 0)}–${fmt(med("MP-50K", "latency_p99_ms"), 0)} ms; about ${fmt(med("SP-50K", "committed_tps") / d.references.r18.tps, 0)} times the throughput of [18] at 50,000 voters on different hardware; per-record cost close to linear in candidates`, `Partly met. Saturation, burst, disk and capstones ${PEND("SP-483K")} ${PEND("SP-3.5M")} ${PEND("MP-3.5M on-chain")}`],
], [1.8, 3, 2], "Sections of this chapter.");
P(`The framework operated correctly at every tier completed so far. Every announced tally equalled the ground truth, every accepted ballot was counted, every proof verified, and the result was reproduced from the ledger's own record. Under the threat model it refused every mounted attack at the gate declared for it, with two limits: ballot reordering is not detected, and several defenses (key-generation transcript validity, partial-decryption proofs) sit with the verifier rather than the chaincode. On one desktop that hosted the whole network, throughput stayed far above the ten-hour arrival rate of every tier measured. It fell as the tiers grew, however, so the capstone results, still pending, decide whether the margin holds at provincial and regional scale.`);

// =====================================================================================
const doc = new Document({
  creator: "BalotaChain", title: "Chapter IV — Results and Discussion",
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 24, bold: true, color: "000000" }, paragraph: { outlineLevel: 0, keepNext: true } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 24, bold: true, italics: true, color: "000000" }, paragraph: { outlineLevel: 1, keepNext: true } },
    ],
  },
  numbering: { config: [{ reference: "num", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 2160, right: 1440 } } },
    children: body,
  }],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log("wrote", OUT, `${tableNo} tables, ${figNo} figures`); });
