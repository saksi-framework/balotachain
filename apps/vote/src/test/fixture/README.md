# Vote app test election

`live-election.json` is a throwaway election for the vote app's tests and for
the `VITE_LIVE_LOCAL=1` build (`/vote/?local=1`). **Every key in it is a
throwaway test key.** The issuer and trustee secrets were deleted when the
script finished; the voter credential only votes in this fixture election.
Never use any of it for a real election.

Browser checks: the local test election needs a build made with
`VITE_LIVE_LOCAL=1` (`/vote/?local=1`); the mock's practice election (for the
failed-check screens, `?mock=1&tamper=1`) needs one made with
`VITE_LIVE_MOCK_SWITCH=1`. Build either with `vite build --outDir` somewhere
outside `dist-web`; `tools/build-web.sh` refuses both flags.

What it holds: the election parameters (`vote-fixture`, President with alice,
bob and carol; Vice President with dan, eve and fay; 3 trustees, threshold 2),
the DKG transcript, the issuer public key, the joint key fingerprint, one
finished voter credential made by a full blind issuance, and the parameters of
the same election under a second issuer key (`other_issuer`), for the test
that a credential is refused against another issuer.

It was made with the saksi native CLI built at saksi commit `6d2555f`:

```
sh apps/vote/src/test/fixture/make-fixture.sh /path/to/saksi-demo
```

The script runs `saksi-demo live` ops `issuer-keygen` (twice),
`election-params` (twice), `trustee-keygen`, `dkg-deal` and `dkg-transcript`
(three trustees), then `voter-begin`, `issue-presign`, `voter-blind`,
`issue-sign` and `voter-finalize`, all in a temporary directory. Regenerate
it when the wire format changes; the vote tests pin the fixture's election
id, positions and key fingerprint, not its random values.
