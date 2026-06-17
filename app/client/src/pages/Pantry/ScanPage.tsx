import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Avatar from "@mui/material/Avatar";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import EditIcon from "@mui/icons-material/Edit";
import { lookupBarcode } from "../../api/pantry";
import type { Product } from "@oikos/shared";

type ScanStatus =
  | "idle"
  | "scanning"
  | "looking_up"
  | "found"
  | "not_found"
  | "error_permission"
  | "error_https";

const ScanPage = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const decodingRef = useRef(false); // prevent re-entrant decode calls
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [zxingModule, setZxingModule] = useState<{ readBarcodesFromImageData: (...args: any[]) => Promise<{ text: string }[]> } | null>(null);

  // Initialise ZXing-WASM once on mount
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        // ZXing-WASM exports prepareZXingModule and readBarcodesFromImageData
        const zxing = await import("zxing-wasm");
        await zxing.prepareZXingModule();
        if (!cancelled) {
          setZxingModule({ readBarcodesFromImageData: zxing.readBarcodesFromImageData });
        }
      } catch {
        // WASM init failure is non-fatal here — camera init will surface any real error
        console.error("ZXing WASM init failed");
      }
    };
    void init();
    return () => { cancelled = true; };
  }, []);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Start camera after ZXing module is ready
  useEffect(() => {
    if (!zxingModule) return;

    // getUserMedia requires HTTPS in production; localhost is exempt
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus(window.location.protocol === "https:" ? "error_permission" : "error_https");
      return;
    }

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus("scanning");
        }
      } catch {
        setStatus("error_permission");
      }
    };

    void startCamera();
    return () => stopCamera();
  }, [zxingModule, stopCamera]);

  // Decode loop — runs on each animation frame while scanning
  useEffect(() => {
    if (status !== "scanning" || !zxingModule) return;

    const decode = async () => {
      if (decodingRef.current) {
        animFrameRef.current = requestAnimationFrame(decode);
        return;
      }
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) { // readyState 2 = HAVE_CURRENT_DATA; below this drawImage produces a blank frame
        animFrameRef.current = requestAnimationFrame(decode);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(decode);
        return;
      }

      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      decodingRef.current = true;
      try {
        const results = await zxingModule.readBarcodesFromImageData(imageData, {
          formats: ["EAN13", "EAN8", "UPCA", "UPCE"],
        });
        if (results.length > 0 && results[0]?.text) {
          const barcode = results[0].text;
          setScannedBarcode(barcode);
          setStatus("looking_up");
          stopCamera(); // stop scanning once a barcode is found
          navigator.vibrate?.(100);

          try {
            const result = await lookupBarcode(barcode);
            if (result.found && result.product) {
              setFoundProduct(result.product);
              setStatus("found");
            } else {
              setStatus("not_found");
            }
          } catch {
            setStatus("not_found");
          }
          setDrawerOpen(true);
          return; // do not schedule another frame
        }
      } catch {
        // decode error is expected on frames with no barcode — keep going
      } finally {
        decodingRef.current = false;
      }

      animFrameRef.current = requestAnimationFrame(decode);
    };

    animFrameRef.current = requestAnimationFrame(decode);
    return () => {
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    };
  }, [status, zxingModule, stopCamera]);

  // Clean up on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  const statusText: Record<ScanStatus, string> = {
    idle: "Initialising...",
    scanning: "Scan a barcode...",
    looking_up: "Looking up product...",
    found: "Product found",
    not_found: "Product not found",
    error_permission: "Camera access denied",
    error_https: "Camera requires HTTPS",
  };

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        bgcolor: "black",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1200,
      }}
    >
      {/* Manual entry button */}
      <Box sx={{ position: "absolute", top: 72, right: 16, zIndex: 10 }}>
        <IconButton
          sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "white" }}
          onClick={() => { stopCamera(); navigate("/pantry/items/new"); }}
          aria-label="add item manually"
        >
          <EditIcon />
        </IconButton>
      </Box>

      {/* Error states */}
      {status === "error_permission" && (
        <Alert severity="error" sx={{ m: 2, maxWidth: 400 }}>
          Camera access denied. Please allow camera access in your browser settings. Camera
          permission is required for barcode scanning.
        </Alert>
      )}
      {status === "error_https" && (
        <Alert severity="warning" sx={{ m: 2, maxWidth: 400 }}>
          Barcode scanning requires HTTPS (or localhost). Camera access is not available over plain
          HTTP on non-localhost addresses.
        </Alert>
      )}

      {/* Video feed */}
      <video
        ref={videoRef}
        muted
        playsInline // required on iOS — without this Safari refuses to autoplay inline
        style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
      />

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Reticule overlay */}
      {(status === "scanning" || status === "looking_up") && (
        <Box
          sx={{
            position: "absolute",
            width: 260,
            height: 160,
            border: "3px solid white",
            borderRadius: 1,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Status text */}
      <Typography
        sx={{
          position: "absolute",
          bottom: "calc(20% + 20px)",
          color: "white",
          textShadow: "0 1px 4px rgba(0,0,0,0.8)",
          fontWeight: 500,
        }}
      >
        {statusText[status]}
      </Typography>

      {/* Back button */}
      <Button
        variant="contained"
        sx={{ position: "absolute", bottom: 24, bgcolor: "rgba(255,255,255,0.2)" }}
        onClick={() => { stopCamera(); navigate("/pantry"); }}
      >
        Cancel
      </Button>

      {/* Result drawer */}
      <Drawer
        anchor="bottom"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { borderRadius: "16px 16px 0 0", p: 2 } }}
      >
        {status === "found" && foundProduct ? (
          <Box>
            <Typography variant="h6" fontWeight={700} mb={2}>
              Product found
            </Typography>
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                {foundProduct.imageUrl ? (
                  <Avatar src={foundProduct.imageUrl} variant="rounded" sx={{ width: 64, height: 64 }} />
                ) : (
                  <Avatar variant="rounded" sx={{ width: 64, height: 64 }}>{foundProduct.name[0]}</Avatar>
                )}
                <Box>
                  <Typography fontWeight={600}>{foundProduct.name}</Typography>
                  {foundProduct.brand && (
                    <Typography variant="body2" color="text.secondary">{foundProduct.brand}</Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
            <Stack spacing={1}>
              <Button
                variant="contained"
                fullWidth
                onClick={() => {
                  setDrawerOpen(false);
                  stopCamera();
                  navigate(`/pantry/items/new?product_id=${foundProduct.id}`);
                }}
              >
                Add to Pantry
              </Button>
              <Button fullWidth onClick={() => { setDrawerOpen(false); stopCamera(); navigate("/pantry"); }}>
                Cancel
              </Button>
            </Stack>
          </Box>
        ) : (
          <Box>
            <Typography variant="h6" fontWeight={700} mb={1}>
              Not in database
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Barcode: {scannedBarcode}
            </Typography>
            <Stack spacing={1}>
              <Button
                variant="contained"
                fullWidth
                onClick={() => {
                  setDrawerOpen(false);
                  stopCamera();
                  navigate(`/pantry/items/new?barcode=${scannedBarcode ?? ""}`);
                }}
              >
                Add manually
              </Button>
              <Button fullWidth onClick={() => { setDrawerOpen(false); stopCamera(); navigate("/pantry"); }}>
                Cancel
              </Button>
            </Stack>
          </Box>
        )}
      </Drawer>
    </Box>
  );
};

export default ScanPage;
