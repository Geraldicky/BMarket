// lib/screens/student/home_screen.dart
// UC-002: Browse Products/Services

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../services/auth_provider.dart';
import '../../theme/app_theme.dart';
import '../../widgets/listing_card.dart';
import '../../widgets/category_chip.dart';
import 'listing_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _searchCtrl = TextEditingController();
  List<ListingModel> _listings = [];
  bool _isLoading = true;
  String? _selectedCategory;
  String? _selectedType;
  String _searchQuery = '';

  final List<Map<String, dynamic>> _categories = [
    {'key': null, 'label': 'Semua', 'icon': Icons.apps_rounded},
    {'key': 'ELECTRONICS', 'label': 'Elektronik', 'icon': Icons.devices_rounded},
    {'key': 'BOOKS', 'label': 'Buku', 'icon': Icons.menu_book_rounded},
    {'key': 'FASHION', 'label': 'Fashion', 'icon': Icons.checkroom_rounded},
    {'key': 'FOOD', 'label': 'Makanan', 'icon': Icons.fastfood_rounded},
    {'key': 'SERVICES', 'label': 'Jasa', 'icon': Icons.handyman_rounded},
    {'key': 'SPORTS', 'label': 'Olahraga', 'icon': Icons.sports_basketball_rounded},
    {'key': 'OTHER', 'label': 'Lainnya', 'icon': Icons.category_rounded},
  ];

  @override
  void initState() {
    super.initState();
    _loadListings();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadListings() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService.getListings(
        category: _selectedCategory,
        type: _selectedType,
        keyword: _searchQuery.isNotEmpty ? _searchQuery : null,
      );
      final data = res['data'] as List;
      setState(() {
        _listings = data.map((e) => ListingModel.fromJson(e)).toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  void _onSearch(String value) {
    setState(() => _searchQuery = value);
    _loadListings();
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _loadListings,
        child: CustomScrollView(
          slivers: [
            // ── App Bar ───────────────────────────
            SliverAppBar(
              expandedHeight: 160,
              floating: true,
              snap: true,
              pinned: false,
              backgroundColor: AppColors.primary,
              flexibleSpace: FlexibleSpaceBar(
                background: Container(
                  decoration: AppDecorations.blueGradient,
                  padding: const EdgeInsets.fromLTRB(20, 48, 20, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Hei, ${user?.name.split(' ').first ?? ''}! 👋',
                                  style: const TextStyle(
                                    
                                    fontSize: 20,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                                const Text(
                                  'Cari apa hari ini?',
                                  style: TextStyle(
                                    
                                    fontSize: 13,
                                    color: Colors.white70,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          // Filter type toggle
                          _TypeToggle(
                            selectedType: _selectedType,
                            onChanged: (t) {
                              setState(() => _selectedType = t);
                              _loadListings();
                            },
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      // Search Bar
                      TextField(
                        controller: _searchCtrl,
                        onSubmitted: _onSearch,
                        onChanged: (v) { if (v.isEmpty) _onSearch(''); },
                        style: const TextStyle(fontSize: 14),
                        decoration: InputDecoration(
                          hintText: 'Cari produk atau jasa...',
                          hintStyle: const TextStyle(fontSize: 14, color: AppColors.grey500),
                          prefixIcon: const Icon(Icons.search_rounded, color: AppColors.grey500),
                          suffixIcon: _searchQuery.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(Icons.close_rounded, color: AppColors.grey500),
                                  onPressed: () {
                                    _searchCtrl.clear();
                                    _onSearch('');
                                  },
                                )
                              : null,
                          filled: true,
                          fillColor: Colors.white,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primaryLight, width: 1.5)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // ── Categories ────────────────────────
            SliverToBoxAdapter(
              child: SizedBox(
                height: 56,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemCount: _categories.length,
                  itemBuilder: (_, i) {
                    final cat = _categories[i];
                    final isSelected = _selectedCategory == cat['key'];
                    return CategoryChip(
                      label: cat['label'],
                      icon: cat['icon'],
                      isSelected: isSelected,
                      onTap: () {
                        setState(() => _selectedCategory = cat['key']);
                        _loadListings();
                      },
                    );
                  },
                ),
              ),
            ),

            // ── Listings ──────────────────────────
            if (_isLoading)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
              )
            else if (_listings.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.search_off_rounded, size: 72, color: AppColors.grey300),
                      const SizedBox(height: 12),
                      Text('Belum ada produk', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AppColors.grey500)),
                      const SizedBox(height: 4),
                      Text('Coba kategori atau pencarian lain', style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.all(16),
                sliver: SliverGrid(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => ListingCard(
                      listing: _listings[i],
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => ListingDetailScreen(listing: _listings[i])),
                      ),
                    ),
                    childCount: _listings.length,
                  ),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 0.72,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _TypeToggle extends StatelessWidget {
  final String? selectedType;
  final ValueChanged<String?> onChanged;
  const _TypeToggle({required this.selectedType, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.2),
        borderRadius: BorderRadius.circular(20),
      ),
      padding: const EdgeInsets.all(2),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _Tab(label: 'Semua', isSelected: selectedType == null, onTap: () => onChanged(null)),
          _Tab(label: 'Produk', isSelected: selectedType == 'PRODUCT', onTap: () => onChanged('PRODUCT')),
          _Tab(label: 'Jasa', isSelected: selectedType == 'SERVICE', onTap: () => onChanged('SERVICE')),
        ],
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;
  const _Tab({required this.label, required this.isSelected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: TextStyle(
            
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: isSelected ? AppColors.primary : Colors.white,
          ),
        ),
      ),
    );
  }
}
