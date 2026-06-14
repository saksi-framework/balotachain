import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:voter/design/design.dart';
import 'package:voter/screens/verification_screen.dart';

class VoteSubmittedScreen extends StatelessWidget {
  const VoteSubmittedScreen({super.key, required this.trackingCode});

  final String trackingCode;

  void _copy(BuildContext context) {
    Clipboard.setData(ClipboardData(text: trackingCode));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Copied')),
    );
  }

  void _verify(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => VerificationScreen(initialCode: trackingCode),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BcColors.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(BcSpace.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: BcSpace.lg),
              Center(
                child: Container(
                  width: 96,
                  height: 96,
                  decoration: const BoxDecoration(
                    color: BcColors.success,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    bcCheck,
                    size: 48,
                    color: BcColors.surface,
                  ),
                ),
              ),
              const SizedBox(height: BcSpace.md),
              const Text(
                'Vote submitted',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: BcType.h1,
                  fontWeight: FontWeight.w700,
                  color: BcColors.text1,
                  height: BcType.lineHeight,
                ),
              ),
              const SizedBox(height: BcSpace.xs),
              const Text(
                'Your ballot has been recorded on the bulletin board.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: BcType.body,
                  color: BcColors.text2,
                  height: BcType.lineHeight,
                ),
              ),
              const SizedBox(height: BcSpace.md),
              BcCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Tracking code',
                      style: TextStyle(
                        fontSize: BcType.body,
                        color: BcColors.text2,
                        height: BcType.lineHeight,
                      ),
                    ),
                    const SizedBox(height: BcSpace.xs),
                    Text(
                      trackingCode,
                      style: const TextStyle(
                        fontSize: BcType.h2,
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
                    const SizedBox(height: BcSpace.sm),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: BcSecondaryButton(
                        label: 'Copy',
                        onPressed: () => _copy(context),
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              BcPrimaryButton(
                label: 'Verify my vote',
                fullWidth: true,
                onPressed: () => _verify(context),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
