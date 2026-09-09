import 'package:flutter/material.dart';
import 'package:voter/design/design.dart';

final RegExp _trackingRegex = RegExp(r'^BC-[0-9A-F]{4}-[0-9A-F]{4}$');

enum _VerifyState { idle, success, error }

/// Verification — paste a tracking code, confirm the ballot was counted.
/// The code never reveals the choice, so the result card is a plain success
/// panel.
class VerificationScreen extends StatefulWidget {
  const VerificationScreen({super.key, this.initialCode});

  final String? initialCode;

  @override
  State<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends State<VerificationScreen> {
  late final TextEditingController _controller;
  _VerifyState _state = _VerifyState.idle;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialCode ?? '');
    _controller.addListener(_onChanged);
  }

  void _onChanged() {
    if (_state != _VerifyState.idle) {
      setState(() => _state = _VerifyState.idle);
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_onChanged);
    _controller.dispose();
    super.dispose();
  }

  void _verify() {
    final code = _controller.text.trim().toUpperCase();
    setState(() {
      _state = _trackingRegex.hasMatch(code)
          ? _VerifyState.success
          : _VerifyState.error;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BcColors.bg,
      appBar: BcTopBar(
        title: 'Verify your vote',
        onBack: () => Navigator.of(context).pop(),
      ),
      body: BcBody(
        padTop: 2,
        children: [
          const Text(
            'Enter your tracking code to confirm your vote was counted.',
            style: TextStyle(
              fontSize: 15,
              color: BcColors.text2,
              height: 1.55,
            ),
          ),
          const SizedBox(height: 22),
          BcTextInput(
            controller: _controller,
            label: 'Tracking code',
            hint: 'BC-XXXX-XXXX',
            mono: true,
          ),
          const SizedBox(height: 18),
          BcPrimaryButton(label: 'Verify', onPressed: _verify),
          if (_state == _VerifyState.success) ...[
            const SizedBox(height: 26),
            const BcRise(key: ValueKey('verified'), child: _VerifiedCard()),
          ],
          if (_state == _VerifyState.error) ...[
            const SizedBox(height: 26),
            const BcRise(key: ValueKey('unverified'), child: _NotFoundCard()),
          ],
          const SizedBox(height: 30),
        ],
      ),
    );
  }
}

class _VerifiedCard extends StatelessWidget {
  const _VerifiedCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: BcColors.successLight,
        borderRadius: BorderRadius.circular(BcRadii.card),
        border: Border.all(color: BcColors.successBorder, width: 1),
      ),
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: BcColors.success,
              shape: BoxShape.circle,
            ),
            child: const Icon(bcCheck, size: 30, color: BcColors.surface),
          ),
          const SizedBox(height: 14),
          const Text(
            'Your vote is recorded and counted',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: BcColors.successText,
              height: 1.35,
            ),
          ),
          const SizedBox(height: BcSpace.xs),
          const Text(
            'Verified on the public bulletin board.',
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

class _NotFoundCard extends StatelessWidget {
  const _NotFoundCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(BcSpace.sm, 14, BcSpace.sm, 14),
      decoration: BoxDecoration(
        color: BcColors.warnLight,
        borderRadius: BorderRadius.circular(BcRadii.button),
        border: Border.all(color: BcColors.warnBorder, width: 1),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(bcAlert, size: 20, color: BcColors.warn),
          SizedBox(width: 11),
          Expanded(
            child: Text(
              "That code isn't in the expected format. Check your receipt and "
              'try again.',
              style: TextStyle(
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
