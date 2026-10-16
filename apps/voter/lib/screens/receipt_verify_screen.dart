import 'package:flutter/material.dart';
import 'package:voter/data/bulletin_store.dart';
import 'package:voter/design/design.dart';

/// Looks a tracking code up on the public board of a live run, through the
/// saksi-campaign console's `GET /api/verify-code/<run>/<code>`. The ballot
/// itself was made by the run's generator; this screen only shows that its
/// record is on the board, and on the chain when the console holds a receipt.
typedef VerifyCodeFn =
    Future<VerifyCodeResult> Function(String run, String code);

/// Run id baked in with `--dart-define=BALOTA_RUN_ID=<id>`.
const String _definedRunId = String.fromEnvironment('BALOTA_RUN_ID');

class ReceiptVerifyScreen extends StatefulWidget {
  const ReceiptVerifyScreen({
    super.key,
    this.initialCode,
    this.initialRunId,
    this.verify,
  });

  final String? initialCode;
  final String? initialRunId;

  /// Test seam. Defaults to [HttpBulletinStore.verifyCode] at
  /// `BALOTA_BULLETIN_URL`.
  final VerifyCodeFn? verify;

  @override
  State<ReceiptVerifyScreen> createState() => _ReceiptVerifyScreenState();
}

class _ReceiptVerifyScreenState extends State<ReceiptVerifyScreen> {
  late final TextEditingController _run;
  late final TextEditingController _code;
  VerifyCodeResult? _result;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _run = TextEditingController(text: widget.initialRunId ?? _definedRunId);
    _code = TextEditingController(text: widget.initialCode ?? '');
  }

  @override
  void dispose() {
    _run.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<VerifyCodeResult> _defaultVerify(String run, String code) async {
    final base = bulletinBaseUrl();
    if (base == null) {
      return const VerifyCodeResult(
        VerifyCodeKind.error,
        message:
            'No console address. Build with '
            '--dart-define=BALOTA_BULLETIN_URL=http://<console>:<port>.',
      );
    }
    return HttpBulletinStore(base).verifyCode(run, code);
  }

  Future<void> _submit() async {
    final run = _run.text.trim();
    final code = _code.text.trim();
    if (run.isEmpty || code.isEmpty) {
      setState(
        () => _result = const VerifyCodeResult(
          VerifyCodeKind.error,
          message: 'Enter both the run id and the tracking code.',
        ),
      );
      return;
    }
    setState(() {
      _busy = true;
      _result = null;
    });
    final result = await (widget.verify ?? _defaultVerify)(run, code);
    if (!mounted) return;
    setState(() {
      _busy = false;
      _result = result;
    });
  }

  String _noticeText(VerifyCodeResult r) => switch (r.kind) {
    VerifyCodeKind.missing =>
      'No ballot record with this tracking code in run '
          '${_run.text.trim()}.',
    VerifyCodeKind.ambiguous =>
      'This tracking code matches more than one ballot record. Ask the '
          'election officer for the full nullifier.',
    _ => 'Could not check the public board. ${r.message}',
  };

  @override
  Widget build(BuildContext context) {
    final result = _result;
    return Scaffold(
      backgroundColor: BcColors.bg,
      appBar: BcTopBar(
        title: 'Public board',
        onBack: () => Navigator.of(context).pop(),
      ),
      body: BcBody(
        padTop: 2,
        children: [
          const Text(
            'Check your tracking code against the public bulletin board of '
            'a live election.',
            style: TextStyle(fontSize: 15, color: BcColors.text2, height: 1.55),
          ),
          const SizedBox(height: 22),
          BcTextInput(controller: _run, label: 'Run id', mono: true),
          const SizedBox(height: 14),
          BcTextInput(
            controller: _code,
            label: 'Tracking code',
            hint: 'BC-XXXX-XXXX',
            mono: true,
          ),
          const SizedBox(height: 18),
          BcPrimaryButton(
            label: _busy ? 'Checking...' : 'Verify',
            onPressed: _busy ? null : _submit,
          ),
          if (result != null) ...[
            const SizedBox(height: 26),
            BcRise(
              key: ValueKey(result.kind),
              child: result.kind == VerifyCodeKind.found
                  ? _FoundCard(result.record!)
                  : _NoticeCard(_noticeText(result)),
            ),
          ],
          const SizedBox(height: 30),
        ],
      ),
    );
  }
}

class _FoundCard extends StatelessWidget {
  const _FoundCard(this.record);

  final VerifyCodeRecord record;

  static String _short(String s) => s.length <= 16
      ? s
      : '${s.substring(0, 8)}...${s.substring(s.length - 6)}';

  @override
  Widget build(BuildContext context) {
    final block = record.blockNumber;
    final rows = <(String, String)>[
      ('Tracking code', record.trackingCode),
      ('Contest', record.positionLabel ?? record.positionId ?? '-'),
      ('Ballot record', '#${record.ballotIndex}'),
      (
        'Ledger',
        record.committedOnChain
            ? (block != null ? 'Committed, block $block' : 'Committed on chain')
            : 'Not confirmed on chain',
      ),
      if (record.txId != null) ('Transaction', _short(record.txId!)),
    ];
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: BcColors.successLight,
        borderRadius: BorderRadius.circular(BcRadii.card),
        border: Border.all(color: BcColors.successBorder, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 56,
              height: 56,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: BcColors.success,
                shape: BoxShape.circle,
              ),
              child: const Icon(bcCheck, size: 30, color: BcColors.surface),
            ),
          ),
          const SizedBox(height: 14),
          const Text(
            'Ballot record found on the public board',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: BcColors.successText,
              height: 1.35,
            ),
          ),
          const SizedBox(height: BcSpace.xs),
          for (final (label, value) in rows)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 13.5,
                      color: BcColors.text2,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      value,
                      textAlign: TextAlign.right,
                      style: const TextStyle(
                        fontFamily: BcType.mono,
                        fontFamilyFallback: BcType.monoFallback,
                        fontSize: 13.5,
                        color: BcColors.successBody,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: BcSpace.sm),
          const Text(
            'The code never reveals your choice.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13.5,
              color: BcColors.text2,
              height: BcType.lineHeight,
            ),
          ),
        ],
      ),
    );
  }
}

class _NoticeCard extends StatelessWidget {
  const _NoticeCard(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(BcSpace.sm, 14, BcSpace.sm, 14),
      decoration: BoxDecoration(
        color: BcColors.warnLight,
        borderRadius: BorderRadius.circular(BcRadii.button),
        border: Border.all(color: BcColors.warnBorder, width: 1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(bcAlert, size: 20, color: BcColors.warn),
          const SizedBox(width: 11),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: BcColors.warnText,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
