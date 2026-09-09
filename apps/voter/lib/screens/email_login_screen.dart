import 'package:flutter/material.dart';
import 'package:voter/design/design.dart';
import 'package:voter/screens/election_home_screen.dart';

final RegExp _emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

/// Email login — passwordless. Continue stays disabled until the address parses.
class EmailLoginScreen extends StatefulWidget {
  const EmailLoginScreen({super.key});

  @override
  State<EmailLoginScreen> createState() => _EmailLoginScreenState();
}

class _EmailLoginScreenState extends State<EmailLoginScreen> {
  final TextEditingController _controller = TextEditingController();
  bool _valid = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_recompute);
  }

  void _recompute() {
    final next = _emailRegex.hasMatch(_controller.text.trim());
    if (next != _valid) {
      setState(() => _valid = next);
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_recompute);
    _controller.dispose();
    super.dispose();
  }

  void _onContinue() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => const ElectionHomeScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BcColors.bg,
      appBar: const BcTopBar(title: 'Sign in'),
      body: Column(
        children: [
          Expanded(
            child: BcBody(
              padTop: 4,
              children: [
                const Text(
                  'Enter your email to securely access your ballot. '
                  'No password needed.',
                  style: TextStyle(
                    fontSize: BcType.body,
                    color: BcColors.text2,
                    height: 1.55,
                  ),
                ),
                const SizedBox(height: 28),
                BcTextInput(
                  controller: _controller,
                  label: 'Email address',
                  hint: 'you@example.com',
                  helper: "We'll use this to identify your ballot.",
                  keyboardType: TextInputType.emailAddress,
                ),
              ],
            ),
          ),
          BcFooter(
            child: BcPrimaryButton(
              label: 'Continue',
              onPressed: _valid ? _onContinue : null,
            ),
          ),
        ],
      ),
    );
  }
}
