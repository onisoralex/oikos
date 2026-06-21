import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import Autocomplete from "@mui/material/Autocomplete";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { type Dayjs } from "dayjs";
import {
  getPantryItem,
  createPantryItem,
  updatePantryItem,
  createProduct,
  getProduct,
} from "../../api/pantry";
import type { Product } from "@oikos/shared";

const UNIT_OPTIONS = ["pcs", "g", "kg", "ml", "l", "pkg", "Dose", "Flasche", "Tüte"];
const LOCATION_OPTIONS = ["Kühlschrank", "Tiefkühler", "Vorrat", "Gefrierfach"];

const AddEditItemPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isEditMode = Boolean(id);
  const productIdParam = searchParams.get("product_id");
  const barcodeParam = searchParams.get("barcode");

  // Item fields
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState<Dayjs | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  // Inline product creation fields (shown when barcode param present but no product_id)
  const [newProductName, setNewProductName] = useState("");
  const [newProductBrand, setNewProductBrand] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackOpen, setSnackOpen] = useState(false);

  const requiresNewProduct = Boolean(barcodeParam && !productIdParam);

  // Load existing item in edit mode
  useEffect(() => {
    if (!isEditMode || !id) return;
    getPantryItem(Number(id))
      .then((item) => {
        setQuantity(item.quantity);
        setUnit(item.unit);
        setExpiryDate(item.expiryDate ? dayjs(item.expiryDate) : null);
        setLocation(item.location);
        setNotes(item.notes ?? "");
        // Load product info for display
        // Reconstruct a minimal Product shape from the denormalised item fields;
        // the edit form only needs name/brand for display and id for submission.
        setProduct({
          id: item.productId,
          name: item.productName,
          brand: item.productBrand,
          category: item.productCategory,
          imageUrl: item.productImageUrl,
          barcode: null,
          nutritionalInfo: null,
          source: "manual",
          offId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      })
      .catch(() => setError("Failed to load item"));
  }, [isEditMode, id]);

  // Load product by product_id param
  useEffect(() => {
    if (!productIdParam) return;
    getProduct(Number(productIdParam))
      .then(setProduct)
      .catch(() => setError("Failed to load product"));
  }, [productIdParam]);

  const handleQuantityStep = (delta: number) => {
    setQuantity((q) => Math.max(0.01, Math.round((q + delta) * 100) / 100)); // round to avoid floating-point drift (e.g. 0.1 + 0.2 = 0.30000000000000004)
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEditMode && !product && !requiresNewProduct) {
      setError("A product is required.");
      return;
    }
    if (quantity <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }
    if (requiresNewProduct && !newProductName.trim()) {
      setError("Product name is required when creating a new product.");
      return;
    }

    setLoading(true);
    try {
      let resolvedProductId = product?.id;

      // Create product first if needed (barcode scan result not in DB)
      if (requiresNewProduct) {
        const created = await createProduct({
          barcode: barcodeParam ?? undefined,
          name: newProductName.trim(),
          brand: newProductBrand.trim() || undefined,
          category: newProductCategory.trim() || undefined,
        });
        resolvedProductId = created.id;
      }

      const itemData = {
        productId: resolvedProductId!,
        quantity,
        unit: unit ?? undefined,
        expiryDate: expiryDate ? expiryDate.format("YYYY-MM-DD") : undefined,
        location: location ?? undefined,
        notes: notes.trim() || undefined,
      };

      if (isEditMode && id) {
        await updatePantryItem(Number(id), {
          quantity: itemData.quantity,
          unit: itemData.unit,
          expiryDate: itemData.expiryDate ?? null,
          location: itemData.location ?? null,
          notes: itemData.notes ?? null,
        });
      } else {
        await createPantryItem(itemData);
      }

      setSnackOpen(true);
      setTimeout(() => navigate("/pantry"), 800);
    } catch {
      setError("Failed to save item. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box maxWidth={480} mx="auto">
        <Typography variant="h6" fontWeight={700} mb={2}>
          {isEditMode ? "Edit Item" : "Add Item"}
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}

            {/* Product display (read-only if from scan or edit mode) */}
            {product ? (
              <TextField
                label="Product"
                value={`${product.name}${product.brand ? ` — ${product.brand}` : ""}`}
                InputProps={{ readOnly: true }}
                fullWidth
              />
            ) : requiresNewProduct ? (
              // Inline product creation when barcode not found
              <Box
                sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 2 }}
              >
                <Typography variant="subtitle2" mb={1} color="text.secondary">
                  New product (barcode: {barcodeParam})
                </Typography>
                <Stack spacing={1.5}>
                  <TextField
                    label="Product name *"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    fullWidth
                    required
                  />
                  <TextField
                    label="Brand"
                    value={newProductBrand}
                    onChange={(e) => setNewProductBrand(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Category"
                    value={newProductCategory}
                    onChange={(e) => setNewProductCategory(e.target.value)}
                    fullWidth
                  />
                </Stack>
              </Box>
            ) : (
              <Alert severity="info">
                No product selected. Please scan a barcode or use a direct link.
              </Alert>
            )}

            {/* Quantity with stepper */}
            <Box display="flex" alignItems="center" gap={1}>
              <IconButton onClick={() => handleQuantityStep(-1)} disabled={quantity <= 1}>
                <RemoveIcon />
              </IconButton>
              <TextField
                label="Quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(0.01, Number(e.target.value)))}
                inputProps={{ min: 0.01, step: 1 }}
                sx={{ flex: 1 }}
              />
              <IconButton onClick={() => handleQuantityStep(1)}>
                <AddIcon />
              </IconButton>
            </Box>

            {/* Unit */}
            <Autocomplete
              options={UNIT_OPTIONS}
              freeSolo
              value={unit ?? ""}
              onChange={(_, v) => setUnit(v)}
              renderInput={(params) => <TextField {...params} label="Unit" />}
            />

            {/* Expiry date */}
            <DatePicker
              label="Expiry date"
              value={expiryDate}
              onChange={(v) => setExpiryDate(v)}
              slotProps={{ textField: { fullWidth: true } }}
            />

            {/* Location */}
            <Autocomplete
              options={LOCATION_OPTIONS}
              freeSolo
              value={location ?? ""}
              onChange={(_, v) => setLocation(v)}
              renderInput={(params) => <TextField {...params} label="Location" />}
            />

            {/* Notes */}
            <TextField
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={3}
              fullWidth
            />

            <Stack direction="row" spacing={1}>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading}
              >
                {loading ? "Saving..." : isEditMode ? "Update" : "Add to Pantry"}
              </Button>
              <Button fullWidth onClick={() => navigate("/pantry")}>
                Cancel
              </Button>
            </Stack>
          </Stack>
        </Box>

        <Snackbar
          open={snackOpen}
          autoHideDuration={2000}
          onClose={() => setSnackOpen(false)}
          message={isEditMode ? "Item updated" : "Item added to pantry"}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default AddEditItemPage;
