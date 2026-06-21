import Chip from "@mui/material/Chip";

interface ExpiryBadgeProps {
  daysUntilExpiry: number | null;
}

const ExpiryBadge = ({ daysUntilExpiry }: ExpiryBadgeProps) => {
  if (daysUntilExpiry === null) {
    return <Chip label="No expiry" size="small" sx={{ bgcolor: "grey.300", color: "text.primary" }} />;
  }
  if (daysUntilExpiry < 0) {
    return <Chip label="Expired" size="small" color="error" />;
  }
  if (daysUntilExpiry <= 3) {
    return <Chip label={`${daysUntilExpiry}d`} size="small" color="error" />;
  }
  if (daysUntilExpiry <= 7) {
    return (
      <Chip
        label={`${daysUntilExpiry}d`}
        size="small"
        sx={{ bgcolor: "warning.main", color: "warning.contrastText" }}
      />
    );
  }
  return (
    <Chip
      label={`${daysUntilExpiry}d`}
      size="small"
      sx={{ bgcolor: "success.main", color: "success.contrastText" }}
    />
  );
};

export default ExpiryBadge;
