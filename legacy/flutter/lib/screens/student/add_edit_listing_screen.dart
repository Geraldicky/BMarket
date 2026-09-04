// lib/screens/student/add_edit_listing_screen.dart
// UC-003: Tambah / Edit Listing

import 'package:flutter/material.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';

class AddEditListingScreen extends StatefulWidget {
  final ListingModel? listing; // null = tambah baru
  const AddEditListingScreen({super.key, this.listing});

  @override
  State<AddEditListingScreen> createState() => _AddEditListingScreenState();
}

class _AddEditListingScreenState extends State<AddEditListingScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _stockCtrl = TextEditingController();

  String _selectedCategory = 'OTHER';
  String _selectedType = 'PRODUCT';
  String? _selectedCondition;
  bool _isSaving = false;

  bool get _isEditing => widget.listing != null;

  final _categories = [
    {'value': 'ELECTRONICS', 'label': 'Elektronik'},
    {'value': 'BOOKS', 'label': 'Buku'},
    {'value': 'FASHION', 'label': 'Fashion'},
    {'value': 'FOOD', 'label': 'Makanan'},
    {'value': 'SERVICES', 'label': 'Jasa'},
    {'value': 'SPORTS', 'label': 'Olahraga'},
    {'value': 'OTHER', 'label': 'Lainnya'},
  ];

  final _conditions = [
    {'value': 'NEW', 'label': 'Baru'},
    {'value': 'LIKE_NEW', 'label': 'Seperti Baru'},
    {'value': 'GOOD', 'label': 'Kondisi Baik'},
    {'value': 'FAIR', 'label': 'Kondisi Cukup'},
  ];

  @override
  void initState() {
    super.initState();
    if (_isEditing) {
      _titleCtrl.text = widget.listing!.title;
      _descCtrl.text = widget.listing!.description;
      _priceCtrl.text = widget.listing!.price.toStringAsFixed(0);
      _selectedCategory = widget.listing!.category;
      _selectedType = widget.listing!.type;
      _selectedCondition = widget.listing!.condition;
      if (widget.listing!.stock != null) {
        _stockCtrl.text = widget.listing!.stock.toString();
      }
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _priceCtrl.dispose();
    _stockCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);
    try {
      final data = {
        'title': _titleCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
        'price': double.parse(_priceCtrl.text.replaceAll('.', '')),
        'category': _selectedCategory,
        'type': _selectedType,
        if (_selectedType == 'PRODUCT' && _selectedCondition != null)
          'condition': _selectedCondition,
        if (_selectedType == 'PRODUCT' && _stockCtrl.text.isNotEmpty)
          'stock': int.parse(_stockCtrl.text),
        'images': <String>[],
      };

      if (_isEditing) {
        await ApiService.updateListing(widget.listing!.id, data);
      } else {
        await ApiService.createListing(data);
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isEditing
              ? 'Listing diperbarui, menunggu review admin'
              : 'Listing berhasil dibuat, menunggu review admin'),
          backgroundColor: AppColors.success,
        ),
      );
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: AppColors.error));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text(_isEditing ? 'Edit Listing' : 'Tambah Listing')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Info banner
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.primaryLighter, borderRadius: BorderRadius.circular(12)),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline_rounded, color: AppColors.primary, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Listing akan direview admin sebelum ditampilkan ke marketplace.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.primary),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // ── Tipe (Produk / Jasa) ──────────
              Text('Tipe Listing', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _TypeButton(label: 'Produk', icon: Icons.inventory_2_outlined, isSelected: _selectedType == 'PRODUCT', onTap: () => setState(() { _selectedType = 'PRODUCT'; _selectedCondition = null; }))),
                  const SizedBox(width: 12),
                  Expanded(child: _TypeButton(label: 'Jasa', icon: Icons.handyman_outlined, isSelected: _selectedType == 'SERVICE', onTap: () => setState(() { _selectedType = 'SERVICE'; _selectedCondition = null; }))),
                ],
              ),
              const SizedBox(height: 20),

              // ── Judul ─────────────────────────
              TextFormField(
                controller: _titleCtrl,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(labelText: 'Judul Listing', hintText: 'Contoh: Laptop Asus Core i5'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Judul wajib diisi' : null,
              ),
              const SizedBox(height: 16),

              // ── Harga ─────────────────────────
              TextFormField(
                controller: _priceCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Harga (Rp)', hintText: '0', prefixIcon: Icon(Icons.attach_money_rounded)),
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Harga wajib diisi';
                  final parsed = double.tryParse(v.replaceAll('.', ''));
                  if (parsed == null || parsed <= 0) return 'Harga harus lebih dari 0';
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // ── Kategori ──────────────────────
              DropdownButtonFormField<String>(
                value: _selectedCategory,
                decoration: const InputDecoration(labelText: 'Kategori', prefixIcon: Icon(Icons.category_outlined)),
                items: _categories.map((c) => DropdownMenuItem(value: c['value'], child: Text(c['label']!, style: const TextStyle()))).toList(),
                onChanged: (v) => setState(() => _selectedCategory = v!),
              ),
              const SizedBox(height: 16),

              // ── Kondisi (hanya untuk Produk) ──
              if (_selectedType == 'PRODUCT') ...[
                DropdownButtonFormField<String>(
                  value: _selectedCondition,
                  decoration: const InputDecoration(labelText: 'Kondisi Barang', prefixIcon: Icon(Icons.star_outline_rounded)),
                  hint: const Text('Pilih kondisi', style: TextStyle()),
                  items: _conditions.map((c) => DropdownMenuItem(value: c['value'], child: Text(c['label']!, style: const TextStyle()))).toList(),
                  onChanged: (v) => setState(() => _selectedCondition = v),
                ),
                const SizedBox(height: 16),

                // ── Jumlah Stok ────────────────────
                TextFormField(
                  controller: _stockCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Jumlah Stok',
                    hintText: 'Contoh: 20',
                    prefixIcon: Icon(Icons.inventory_2_outlined),
                    helperText: 'Kosongkan jika stok tidak terbatas',
                  ),
                  validator: (v) {
                    if (v != null && v.isNotEmpty) {
                      final parsed = int.tryParse(v);
                      if (parsed == null || parsed < 1) return 'Stok harus angka minimal 1';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
              ],

              // ── Deskripsi ─────────────────────
              TextFormField(
                controller: _descCtrl,
                maxLines: 5,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Deskripsi',
                  hintText: 'Jelaskan detail produk/jasa kamu...',
                  alignLabelWithHint: true,
                ),
                validator: (v) => (v == null || v.trim().length < 10) ? 'Deskripsi minimal 10 karakter' : null,
              ),
              const SizedBox(height: 32),

              // ── Save Button ───────────────────
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isSaving ? null : _save,
                  child: _isSaving
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text(_isEditing ? 'Simpan Perubahan' : 'Kirim untuk Review'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TypeButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;
  const _TypeButton({required this.label, required this.icon, required this.isSelected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isSelected ? AppColors.primary : AppColors.grey300, width: 1.5),
        ),
        child: Column(
          children: [
            Icon(icon, color: isSelected ? Colors.white : AppColors.grey600, size: 24),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: isSelected ? Colors.white : AppColors.grey700)),
          ],
        ),
      ),
    );
  }
}
