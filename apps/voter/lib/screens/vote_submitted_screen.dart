import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:voter/design/design.dart';
import 'package:voter/screens/verification_screen.dart';

/// Vote submitted — success ring, the tracking code with a copy affordance,
/// then verify / done.
class VoteSubmittedScreen extends StatefulWidget {
  const VoteSubmittedScreen({super.key, required this.trackingCode});

  final String trackingCode;

  @override
  State<VoteSubmittedScreen> createState() => _VoteSubmittedScreenState();
}

class _VoteSubmittedScreenState extends State<VoteSubmittedScreen> {
  bool _copied = false;

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: widget.trackingCode));
    if (!mounted) return;
    setState(() => _copied = true);
    await Future<void>.delayed(const Duration(milliseconds: 1800));
    if (!mounted) return;
    setState(() => _copied = false);
  }

  void _verify() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => VerificationScreen(initialCode: widget.trackingCode),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BcColors.bg,
      body: Column(
        children: [
          const SafeArea(bottom: false, child: SizedBox(height: 24)),
          Expanded(
            child: BcBody(
              children: [
                const Center(child: BcPop(child: _SuccessRing())),
                const SizedBox(height: 22),
                const Text(
                  'Vote submitted',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    color: BcColors.text1,
                    height: 1.25,
                  ),
                ),
                const SizedBox(height: 10),
                // ConstrainedBox has no const constructor, so this subtree
                // stops at the Text.
                Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 290),
                    child: const Text(
                      'Your vote has been securely recorded.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: BcType.body,
                        color: BcColors.text2,
                        height: 1.55,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 28),
                BcCard(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'YOUR TRACKING CODE',
                        style: TextStyle(
                          fontSize: BcType.eyebrow,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                          color: BcColors.text2,
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        widget.trackingCode,
                        style: const TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w600,
                          color: BcColors.tealDark,
                          letterSpacing: 2,
                          height: 1.2,
                          fontFamily: BcType.mono,
                          fontFamilyFallback: <String>[
                            'Menlo',
                            'Courier New',
                            'monospace',
                          ],
                        ),
                      ),
                      const SizedBox(height: BcSpace.sm),
                      _CopyButton(copied: _copied, onTap: _copy),
                      const SizedBox(height: 14),
                      const Text(
                        'Keep this code to verify your vote anytime — it never '
                        'reveals your choice.',
                        style: TextStyle(
                          fontSize: BcType.small,
                          color: BcColors.text2,
                          height: BcType.lineHeight,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          BcFooter(
            child: Column(
              children: [
                BcPrimaryButton(label: 'Verify my vote', onPressed: _verify),
                const SizedBox(height: 12),
                BcSecondaryButton(
                  label: 'Done',
                  onPressed: () =>
                      Navigator.of(context).popUntil((r) => r.isFirst),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SuccessRing extends StatelessWidget {
  const _SuccessRing();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 92,
      height: 92,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        color: BcColors.successLight,
        shape: BoxShape.circle,
      ),
      child: Container(
        width: 64,
        height: 64,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          color: BcColors.success,
          shape: BoxShape.circle,
        ),
        child: const Icon(bcCheck, size: 36, color: BcColors.surface),
      ),
    );
  }
}

class _CopyButton extends StatelessWidget {
  const _CopyButton({required this.copied, required this.onTap});

  final bool copied;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = copied ? BcColors.teal : BcColors.text1;
    return Semantics(
      button: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          height: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: copied ? BcColors.tealLight : BcColors.surface,
            borderRadius: BorderRadius.circular(BcRadii.button),
            border: Border.all(color: BcColors.border, width: 1.5),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(copied ? bcCheck : bcCopy, size: 18, color: fg),
              const SizedBox(width: BcSpace.xs),
              Text(
                copied ? 'Copied' : 'Copy code',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: fg,
                  height: 1.2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
