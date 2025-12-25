import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_text_field.dart';
import '../../../data/providers/document_provider.dart';
import '../../../data/models/document.dart';

class CreateDocumentScreen extends ConsumerStatefulWidget {
  const CreateDocumentScreen({super.key});

  @override
  ConsumerState<CreateDocumentScreen> createState() => _CreateDocumentScreenState();
}

class _CreateDocumentScreenState extends ConsumerState<CreateDocumentScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _contentController = TextEditingController();
  DocumentCategory? _selectedCategory;
  int _currentStep = 0;

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  Future<void> _handleCreate() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedCategory == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select a category'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final document = await ref.read(documentsProvider.notifier).createDocument(
          title: _titleController.text.trim(),
          category: _selectedCategory!,
          content: _contentController.text.trim(),
        );

    if (document != null && mounted) {
      context.go('/documents/${document.id}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(documentsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Document'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
      ),
      body: Form(
        key: _formKey,
        child: Stepper(
          currentStep: _currentStep,
          onStepContinue: () {
            if (_currentStep < 2) {
              setState(() => _currentStep++);
            } else {
              _handleCreate();
            }
          },
          onStepCancel: () {
            if (_currentStep > 0) {
              setState(() => _currentStep--);
            } else {
              context.pop();
            }
          },
          controlsBuilder: (context, details) {
            return Padding(
              padding: const EdgeInsets.only(top: AppSpacing.lg),
              child: Row(
                children: [
                  Expanded(
                    child: AppButton(
                      label: _currentStep == 2 ? 'Create Document' : 'Continue',
                      isLoading: state.isLoading,
                      onPressed: details.onStepContinue,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  if (_currentStep > 0)
                    Expanded(
                      child: AppButton(
                        label: 'Back',
                        variant: AppButtonVariant.outline,
                        onPressed: details.onStepCancel,
                      ),
                    ),
                ],
              ),
            );
          },
          steps: [
            // Step 1: Category
            Step(
              title: const Text('Select Category'),
              subtitle: _selectedCategory != null
                  ? Text(_selectedCategory!.displayName)
                  : null,
              isActive: _currentStep >= 0,
              state: _currentStep > 0 ? StepState.complete : StepState.indexed,
              content: Column(
                children: DocumentCategory.values.map((category) {
                  final isSelected = _selectedCategory == category;
                  return Card(
                    margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                    color: isSelected ? AppColors.primaryLight : null,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      side: BorderSide(
                        color: isSelected ? AppColors.primary : AppColors.border,
                        width: isSelected ? 2 : 1,
                      ),
                    ),
                    child: InkWell(
                      onTap: () {
                        setState(() => _selectedCategory = category);
                      },
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        child: Row(
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: category.color.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(AppRadius.sm),
                              ),
                              child: Icon(
                                category.icon,
                                color: category.color,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.md),
                            Expanded(
                              child: Text(
                                category.displayName,
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ),
                            if (isSelected)
                              const Icon(
                                Icons.check_circle,
                                color: AppColors.primary,
                              ),
                          ],
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),

            // Step 2: Details
            Step(
              title: const Text('Document Details'),
              subtitle: _titleController.text.isNotEmpty
                  ? Text(_titleController.text)
                  : null,
              isActive: _currentStep >= 1,
              state: _currentStep > 1 ? StepState.complete : StepState.indexed,
              content: Column(
                children: [
                  AppTextField(
                    controller: _titleController,
                    label: 'Document Title',
                    hint: 'Enter a title for your document',
                    textInputAction: TextInputAction.next,
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Title is required';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: AppSpacing.md),
                  AppTextField(
                    controller: _contentController,
                    label: 'Description (Optional)',
                    hint: 'Add any notes or description',
                    maxLines: 4,
                  ),
                ],
              ),
            ),

            // Step 3: Review
            Step(
              title: const Text('Review'),
              isActive: _currentStep >= 2,
              content: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _ReviewItem(
                    label: 'Category',
                    value: _selectedCategory?.displayName ?? 'Not selected',
                    icon: _selectedCategory?.icon ?? Icons.category,
                    iconColor: _selectedCategory?.color ?? AppColors.textSecondary,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _ReviewItem(
                    label: 'Title',
                    value: _titleController.text.isEmpty
                        ? 'Not set'
                        : _titleController.text,
                    icon: Icons.title,
                    iconColor: AppColors.primary,
                  ),
                  if (_contentController.text.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.md),
                    _ReviewItem(
                      label: 'Description',
                      value: _contentController.text,
                      icon: Icons.notes,
                      iconColor: AppColors.secondary,
                    ),
                  ],
                  const SizedBox(height: AppSpacing.lg),
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: AppColors.infoLight,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline, color: AppColors.info),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Text(
                            'AI will generate your document based on the provided information.',
                            style: TextStyle(
                              fontSize: 13,
                              color: AppColors.info,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReviewItem extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color iconColor;

  const _ReviewItem({
    required this.label,
    required this.value,
    required this.icon,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: iconColor.withOpacity(0.1),
            borderRadius: BorderRadius.circular(AppRadius.sm),
          ),
          child: Icon(icon, color: iconColor, size: 20),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
