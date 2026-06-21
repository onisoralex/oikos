import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Fab from "@mui/material/Fab";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Collapse from "@mui/material/Collapse";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import AddIcon from "@mui/icons-material/Add";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { listPantryItems, getExpiringItems } from "../../api/pantry";
import type { ListItemsParams } from "../../api/pantry";
import ExpiryBadge from "../../components/ExpiryBadge";
import type { PantryItemWithProduct } from "@oikos/shared";

type SortOption = "expiry_asc" | "name_asc" | "added_desc";

const PantryOverviewPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<PantryItemWithProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [sort, setSort] = useState<SortOption>("added_desc");
  const [expiredOpen, setExpiredOpen] = useState(true);
  const [expiringCount, setExpiringCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params: ListItemsParams = { page, pageSize: 25, sort };
      if (debouncedSearch) params.search = debouncedSearch;
      if (category) params.category = category;
      if (location) params.location = location;
      if (expiringSoon) params.expiring_within_days = 7;
      const res = await listPantryItems(params);
      setItems(res.data);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (e) {
      console.error("Failed to fetch pantry items", e);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, category, location, expiringSoon, sort]);

  useEffect(() => {
    void fetchItems(); // void discards the promise — lint requires explicit discard for floating async in useEffect
  }, [fetchItems]);

  // Fetch expiring items count for the banner on mount
  useEffect(() => {
    getExpiringItems(7)
      .then((res) => setExpiringCount(res.expiring_soon.length + res.expired.length))
      .catch(() => {});
  }, []);

  const expiredItems = items.filter(
    (i) => i.daysUntilExpiry !== null && i.daysUntilExpiry < 0,
  );
  const normalItems = items.filter(
    (i) => i.daysUntilExpiry === null || i.daysUntilExpiry >= 0,
  );

  const renderItemCard = (item: PantryItemWithProduct) => (
    <Card key={item.id} variant="outlined" sx={{ mb: 1 }}>
      <CardActionArea onClick={() => navigate(`/pantry/items/${item.id}/edit`)}>
        <CardContent sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          {item.productImageUrl ? (
            <Avatar src={item.productImageUrl} variant="rounded" sx={{ width: 56, height: 56 }} />
          ) : (
            <Avatar variant="rounded" sx={{ width: 56, height: 56, bgcolor: "primary.light" }}>
              {item.productName[0]}
            </Avatar>
          )}
          <Box flex={1} minWidth={0}>
            <Typography variant="body1" fontWeight={600} noWrap>
              {item.productName}
            </Typography>
            {item.productBrand && (
              <Typography variant="body2" color="text.secondary" noWrap>
                {item.productBrand}
              </Typography>
            )}
            <Stack direction="row" spacing={1} alignItems="center" mt={0.5} flexWrap="wrap">
              <Typography variant="body2">
                {item.quantity} {item.unit ?? "pcs"}
              </Typography>
              {item.location && (
                <Chip label={item.location} size="small" variant="outlined" />
              )}
              <ExpiryBadge daysUntilExpiry={item.daysUntilExpiry} />
            </Stack>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );

  return (
    <Box>
      {/* Expiring soon banner */}
      {expiringCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {expiringCount} item{expiringCount !== 1 ? "s" : ""} expiring soon or already expired
        </Alert>
      )}

      {/* Search and filters */}
      <Stack spacing={1} mb={2}>
        <TextField
          label="Search"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          size="small"
          fullWidth
        />

        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip
            label="Expiring soon"
            onClick={() => { setExpiringSoon((v) => !v); setPage(1); }}
            color={expiringSoon ? "warning" : "default"}
            variant={expiringSoon ? "filled" : "outlined"}
          />
          {category && (
            <Chip label={`Category: ${category}`} onDelete={() => setCategory("")} />
          )}
          {location && (
            <Chip label={`Location: ${location}`} onDelete={() => setLocation("")} />
          )}
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Sort</InputLabel>
            <Select
              value={sort}
              label="Sort"
              onChange={(e) => { setSort(e.target.value as SortOption); setPage(1); }}
            >
              <MenuItem value="name_asc">Name A–Z</MenuItem>
              <MenuItem value="expiry_asc">Expiry ↑</MenuItem>
              <MenuItem value="added_desc">Date added ↓</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary">
            {total} item{total !== 1 ? "s" : ""}
          </Typography>
        </Stack>
      </Stack>

      {/* Expired items (collapsible) */}
      {expiredItems.length > 0 && (
        <Box mb={2}>
          <Button
            startIcon={expiredOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setExpiredOpen((v) => !v)}
            color="error"
            sx={{ mb: 1, fontWeight: 700 }}
          >
            Expired ({expiredItems.length})
          </Button>
          <Collapse in={expiredOpen}>
            {expiredItems.map(renderItemCard)}
          </Collapse>
        </Box>
      )}

      {/* Normal items */}
      {loading ? (
        <Typography color="text.secondary">Loading...</Typography>
      ) : normalItems.length === 0 && expiredItems.length === 0 ? (
        <Typography color="text.secondary">No items found.</Typography>
      ) : (
        normalItems.map(renderItemCard)
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box mt={2} display="flex" justifyContent="center">
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, v) => setPage(v)}
            color="primary"
          />
        </Box>
      )}

      {/* FAB for adding items */}
      <Fab
        color="primary"
        sx={{ position: "fixed", bottom: 72, right: 16 }}
        onClick={() => navigate("/pantry/scan")}
        aria-label="scan barcode"
      >
        <QrCodeScannerIcon />
      </Fab>
      <Fab
        size="small"
        sx={{ position: "fixed", bottom: 132, right: 16 }}
        onClick={() => navigate("/pantry/items/new")}
        aria-label="add item manually"
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default PantryOverviewPage;
