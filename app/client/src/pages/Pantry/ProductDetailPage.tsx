import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Avatar from "@mui/material/Avatar";
import Snackbar from "@mui/material/Snackbar";
import { getProduct, updateProduct } from "../../api/pantry";
import type { Product } from "@oikos/shared";

const nutritionLabels: { key: keyof NonNullable<Product["nutritionalInfo"]>; label: string; unit: string }[] = [
  { key: "energy_kcal_100g", label: "Energy", unit: "kcal/100g" },
  { key: "fat_100g", label: "Fat", unit: "g/100g" },
  { key: "saturated_fat_100g", label: "Saturated fat", unit: "g/100g" },
  { key: "carbohydrates_100g", label: "Carbohydrates", unit: "g/100g" },
  { key: "sugars_100g", label: "Sugars", unit: "g/100g" },
  { key: "fiber_100g", label: "Fibre", unit: "g/100g" },
  { key: "proteins_100g", label: "Protein", unit: "g/100g" },
  { key: "salt_100g", label: "Salt", unit: "g/100g" },
];

const ProductDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    getProduct(Number(id))
      .then((p) => {
        setProduct(p);
        setEditName(p.name);
        setEditBrand(p.brand ?? "");
        setEditCategory(p.category ?? "");
      })
      .catch(() => setError("Failed to load product"));
  }, [id]);

  const handleSave = async () => {
    if (!product || !id) return;
    setSaving(true);
    try {
      const updated = await updateProduct(Number(id), {
        name: editName,
        brand: editBrand || undefined,
        category: editCategory || undefined,
      });
      setProduct(updated);
      setEditing(false);
      setSnackOpen(true);
    } catch {
      setError("Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!product) {
    return <Typography color="text.secondary">Loading...</Typography>;
  }

  return (
    <Box maxWidth={600} mx="auto">
      <Stack direction="row" spacing={2} alignItems="flex-start" mb={3}>
        {product.imageUrl ? (
          <Avatar src={product.imageUrl} variant="rounded" sx={{ width: 80, height: 80 }} />
        ) : (
          <Avatar variant="rounded" sx={{ width: 80, height: 80, fontSize: 32 }}>
            {product.name[0]}
          </Avatar>
        )}
        <Box flex={1}>
          {editing ? (
            <Stack spacing={1}>
              <TextField
                label="Name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                size="small"
                fullWidth
              />
              <TextField
                label="Brand"
                value={editBrand}
                onChange={(e) => setEditBrand(e.target.value)}
                size="small"
                fullWidth
              />
              <TextField
                label="Category"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                size="small"
                fullWidth
              />
              <Stack direction="row" spacing={1}>
                <Button variant="contained" size="small" onClick={handleSave} disabled={saving}>
                  Save
                </Button>
                <Button size="small" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </Stack>
            </Stack>
          ) : (
            <>
              <Typography variant="h6" fontWeight={700}>{product.name}</Typography>
              {product.brand && <Typography color="text.secondary">{product.brand}</Typography>}
              {product.category && (
                <Chip label={product.category} size="small" sx={{ mt: 0.5 }} />
              )}
            </>
          )}
        </Box>
      </Stack>

      {/* Metadata */}
      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
        <Chip label={`Source: ${product.source}`} size="small" color={product.source === "off" ? "primary" : "default"} />
        {product.barcode && <Chip label={`Barcode: ${product.barcode}`} size="small" variant="outlined" />}
      </Stack>

      {/* Nutritional info table */}
      {product.nutritionalInfo && (
        <Box mb={3}>
          <Typography variant="subtitle1" fontWeight={600} mb={1}>
            Nutritional info
          </Typography>
          <Table size="small">
            <TableBody>
              {nutritionLabels.map(({ key, label, unit }) => {
                const value = product.nutritionalInfo?.[key];
                if (value === null || value === undefined) return null;
                return (
                  <TableRow key={key}>
                    <TableCell>{label}</TableCell>
                    <TableCell align="right">
                      {typeof value === "number" ? value.toFixed(1) : String(value)} {unit}
                    </TableCell>
                  </TableRow>
                );
              })}
              {product.nutritionalInfo.nutriscore_grade && (
                <TableRow>
                  <TableCell>Nutri-Score</TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={700} textTransform="uppercase">
                      {product.nutritionalInfo.nutriscore_grade}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* Allergens */}
      {product.nutritionalInfo?.allergens && product.nutritionalInfo.allergens.length > 0 && (
        <Box mb={3}>
          <Typography variant="subtitle1" fontWeight={600} mb={1}>
            Allergens
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {product.nutritionalInfo.allergens.map((a) => (
              <Chip key={a} label={a} size="small" color="warning" />
            ))}
          </Stack>
        </Box>
      )}

      {/* Actions */}
      <Stack direction="row" spacing={1}>
        {!editing && (
          <Button variant="outlined" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
        <Button
          onClick={() => navigate(`/pantry?product_id=${product.id}`)}
          variant="outlined"
        >
          View pantry items
        </Button>
        {/* Note: /pantry supports ?product_id= filter param in the URL, but the current
            list API endpoint may not support product_id filtering — in that case the
            overview page will load all items. No backend modification in this task. */}
      </Stack>

      <Snackbar
        open={snackOpen}
        autoHideDuration={2000}
        onClose={() => setSnackOpen(false)}
        message="Product updated"
      />
    </Box>
  );
};

export default ProductDetailPage;
