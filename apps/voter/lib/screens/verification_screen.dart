import 'package:flutter/material.dart';
import 'package:voter/design/design.dart';

final RegExp _trackingRegex = RegExp(r'^BC-[0-9A-F]{4}-[0-9A-F]{4}$');

enum _VerifyState { idle, success, error }

class VerificationScreen extends StatefulWidget {
  const VerificationScreen({super.key, this.initialCode});

  final String? initialCode;

  @override
  State<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends State<VerificationScreen> {
  late final TextEditingController _controller;
  _VerifyState _state = _VerifyState.idle;
  String _verifiedCode = '';
  String _verifiedTimestamp = '';

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

  String _formatNow() {
    final now = DateTime.now();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${now.year}-${two(now.month)}-${two(now.day)} '
        '${two(now.hour)}:${two(now.minute)}';
  }

  void _verify() {
    final code = _controller.text.trim().toUpperCase();
    final ok = _trackingRegex.hasMatch(code);
    setState(() {
      if (ok) {
        _state = _VerifyState.success;
        _verifiedCode = code;
        _verifiedTimestamp = _formatNow();
      } else {
        _state = _VerifyState.error;
      }
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
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(BcSpace.md),
          children: [
            const Text(
              'Enter your tracking code.',
              style: TextStyle(
                fontSize: BcType.body,
                color: BcColors.text2,
                height: BcType.lineHeight,
              ),
            ),
            const SizedBox(height: BcSpace.md),
            BcTextInput(
              controller: _controller,
              hint: 'BC-XXXX-XXXX',
              mono: true,
            ),
            if (_state == _VerifyState.error) ...[
              const SizedBox(height: BcSpace.xs),
              const Text(
                'Tracking code not found.',
                style: TextStyle(
                  fontSize: BcType.body,
                  color: BcColors.error,
                  height: BcType.lineHeight,
                ),
              ),
            ],
            const SizedBox(height: BcSpace.md),
            BcPrimaryButton(
              label: 'Verify',
              fullWidth: true,
              onPressed: _verify,
            ),
            if (_state == _VerifyState.success) ...[
              const SizedBox(height: BcSpace.md),
              _SuccessCard(
                code: _verifiedCode,
                timestamp: _verifiedTimestamp,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SuccessCard extends StatelessWidget {
  const _SuccessCard({required this.code, required this.timestamp});

  final String code;
  final String timestamp;

  @override
  Widget build(BuildContext context) {
    return BcCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: const BoxDecoration(
                  color: BcColors.success,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  bcCheck,
                  size: 24,
                  color: BcColors.surface,
                ),
              ),
              const SizedBox(width: BcSpace.sm),
              const Expanded(
                child: Text(
                  'Vote verified',
                  style: TextStyle(
                    fontSize: BcType.h2,
                    fontWeight: FontWeight.w700,
                    color: BcColors.text1,
                    height: BcType.lineHeight,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: BcSpace.sm),
          Text(
            'Your ballot was recorded on $timestamp',
            style: const TextStyle(
              fontSize: BcType.body,
              color: BcColors.text2,
              height: BcType.lineHeight,
            ),
          ),
          const SizedBox(height: BcSpace.xs),
          Text(
            code,
            style: const TextStyle(
              fontSize: BcType.body,
              fontWeight: FontWeight.w700,
              color: BcColors.text1,
              height: BcType.lineHeight,
              fontFamily: 'monospace',
              fontFamilyFallback: <String>[
                'Menlo',
                'Courier New',
                'monospace',
              ],
              letterSpacing: 1,
            ),
          ),
        ],
      ),
    );
  }
}
