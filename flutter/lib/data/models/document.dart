import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

enum DocumentCategory {
  businessFormation,
  employmentHr,
  realEstate,
  intellectualProperty,
  familyLaw,
  estatePlanning,
}

extension DocumentCategoryExtension on DocumentCategory {
  String get displayName {
    switch (this) {
      case DocumentCategory.businessFormation:
        return 'Business Formation';
      case DocumentCategory.employmentHr:
        return 'Employment & HR';
      case DocumentCategory.realEstate:
        return 'Real Estate';
      case DocumentCategory.intellectualProperty:
        return 'Intellectual Property';
      case DocumentCategory.familyLaw:
        return 'Family Law';
      case DocumentCategory.estatePlanning:
        return 'Estate Planning';
    }
  }

  IconData get icon {
    switch (this) {
      case DocumentCategory.businessFormation:
        return Icons.business;
      case DocumentCategory.employmentHr:
        return Icons.people;
      case DocumentCategory.realEstate:
        return Icons.home;
      case DocumentCategory.intellectualProperty:
        return Icons.lightbulb;
      case DocumentCategory.familyLaw:
        return Icons.family_restroom;
      case DocumentCategory.estatePlanning:
        return Icons.account_balance;
    }
  }

  Color get color {
    switch (this) {
      case DocumentCategory.businessFormation:
        return AppColors.categoryBusiness;
      case DocumentCategory.employmentHr:
        return AppColors.categoryEmployment;
      case DocumentCategory.realEstate:
        return AppColors.categoryRealEstate;
      case DocumentCategory.intellectualProperty:
        return AppColors.categoryIntellectual;
      case DocumentCategory.familyLaw:
        return AppColors.categoryFamily;
      case DocumentCategory.estatePlanning:
        return AppColors.categoryEstate;
    }
  }
}

enum DocumentStatus {
  draft,
  final_,
  signed,
}

extension DocumentStatusExtension on DocumentStatus {
  String get displayName {
    switch (this) {
      case DocumentStatus.draft:
        return 'Draft';
      case DocumentStatus.final_:
        return 'Final';
      case DocumentStatus.signed:
        return 'Signed';
    }
  }

  Color get color {
    switch (this) {
      case DocumentStatus.draft:
        return AppColors.statusDraft;
      case DocumentStatus.final_:
        return AppColors.statusFinal;
      case DocumentStatus.signed:
        return AppColors.statusSigned;
    }
  }
}

class Document {
  final String id;
  final String title;
  final DocumentCategory category;
  final String content;
  final DocumentStatus status;
  final String? clientId;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Document({
    required this.id,
    required this.title,
    required this.category,
    required this.content,
    required this.status,
    this.clientId,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Document.fromJson(Map<String, dynamic> json) {
    return Document(
      id: json['id'] as String,
      title: json['title'] as String,
      category: DocumentCategory.values.firstWhere(
        (e) => e.name == json['category'],
        orElse: () => DocumentCategory.businessFormation,
      ),
      content: json['content'] as String,
      status: DocumentStatus.values.firstWhere(
        (e) => e.name == json['status'],
        orElse: () => DocumentStatus.draft,
      ),
      clientId: json['clientId'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'category': category.name,
        'content': content,
        'status': status.name,
        'clientId': clientId,
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
      };

  Document copyWith({
    String? id,
    String? title,
    DocumentCategory? category,
    String? content,
    DocumentStatus? status,
    String? clientId,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Document(
      id: id ?? this.id,
      title: title ?? this.title,
      category: category ?? this.category,
      content: content ?? this.content,
      status: status ?? this.status,
      clientId: clientId ?? this.clientId,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

class DocumentTemplate {
  final String id;
  final String name;
  final String description;
  final DocumentCategory category;
  final List<String> fields;

  const DocumentTemplate({
    required this.id,
    required this.name,
    required this.description,
    required this.category,
    required this.fields,
  });

  factory DocumentTemplate.fromJson(Map<String, dynamic> json) {
    return DocumentTemplate(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String,
      category: DocumentCategory.values.firstWhere(
        (e) => e.name == json['category'],
        orElse: () => DocumentCategory.businessFormation,
      ),
      fields: List<String>.from(json['fields'] as List),
    );
  }
}
