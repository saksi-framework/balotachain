import 'package:flutter/material.dart';
import '../tokens.dart';

class BcTextInput extends StatelessWidget {
  const BcTextInput({
    super.key,
    required this.controller,
    this.hint,
    this.mono = false,
    this.keyboardType,
  });

  final TextEditingController controller;
  final String? hint;
  final bool mono;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    final textStyle = TextStyle(
      fontSize: BcType.body,
      height: BcType.lineHeight,
      color: BcColors.text1,
      fontFamily: mono ? 'monospace' : null,
              fontFamilyFallback: mono
                  ? const ['Menlo', 'Courier New', 'monospace']
                  : null,
    );

    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      style: textStyle,
      cursorColor: BcColors.teal,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: textStyle.copyWith(color: BcColors.text2),
        filled: true,
        fillColor: BcColors.surface,
        contentPadding: const EdgeInsets.all(BcSpace.sm),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(BcRadii.button),
          borderSide: const BorderSide(color: BcColors.border, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(BcRadii.button),
          borderSide: const BorderSide(color: BcColors.border, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(BcRadii.button),
          borderSide: const BorderSide(color: BcColors.teal, width: 1),
        ),
      ),
    );
  }
}
