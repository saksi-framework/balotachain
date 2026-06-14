import 'package:flutter/material.dart';
import 'package:voter/design/design.dart';
import 'package:voter/screens/election_home_screen.dart';

final RegExp _emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

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
      MaterialPageRoute<void>(
        builder: (_) => const ElectionHomeScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BcColors.bg,
      appBar: const BcTopBar(title: 'Sign in'),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(BcSpace.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Enter your email to receive your ballot.',
                style: TextStyle(
                  fontSize: BcType.body,
                  color: BcColors.text2,
                  height: BcType.lineHeight,
                ),
              ),
              const SizedBox(height: BcSpace.md),
              BcTextInput(
                controller: _controller,
                hint: 'you@example.edu.ph',
                keyboardType: TextInputType.emailAddress,
              ),
              const Spacer(),
              BcPrimaryButton(
                label: 'Continue',
                fullWidth: true,
                onPressed: _valid ? _onContinue : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
