"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ImagePlus, LoaderCircle, Save, Trash2 } from "lucide-react";
import { adminRequest, errorMessage } from "../admin-api";
import { ErrorState, LoadingState, PageHeading } from "../admin-components";
import type { AdminProduct, ProductStatus, StockStatus } from "../admin-types";

type ProductFormState = {
  name: string;
  slug: string;
  sku: string;
  description: string;
  category: string;
  price: string;
  currency: string;
  stockStatus: StockStatus;
  stockQuantity: string;
  sourceUrl: string;
  imageUrl: string;
  status: ProductStatus;
  featured: boolean;
};

const emptyForm: ProductFormState = {
  name: "",
  slug: "",
  sku: "",
  description: "",
  category: "Other",
  price: "",
  currency: "usd",
  stockStatus: "in_stock",
  stockQuantity: "",
  sourceUrl: "",
  imageUrl: "",
  status: "draft",
  featured: false,
};

export default function ProductForm({ productId }: { productId?: string }) {
  const router = useRouter();
  const editing = Boolean(productId);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError("");
    try {
      const response = await adminRequest<{ product: AdminProduct }>(`/api/admin/products/${encodeURIComponent(productId)}`);
      setProduct(response.product);
      setForm(toForm(response.product));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!imageFile) { setPreviewUrl(""); return; }
    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  const displayImage = previewUrl || form.imageUrl || product?.imageUrl || "";
  const imageMeta = useMemo(() => imageFile ? `${imageFile.name} · ${imageFile.type || "unknown type"} · ${formatBytes(imageFile.size)}` : "", [imageFile]);

  function update<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    if (next && !["image/png", "image/jpeg", "image/webp", "image/avif"].includes(next.type)) {
      setImageFile(null);
      setError("Use a PNG, JPEG, WebP, or AVIF image.");
      event.target.value = "";
      return;
    }
    if (next && next.size > 8 * 1024 * 1024) {
      setImageFile(null);
      setError("Product images must be 8 MB or smaller.");
      event.target.value = "";
      return;
    }
    setError("");
    setImageFile(next);
    setSuccess(next ? "Image selected. It will upload after the product record saves." : "");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const body = productPayload(form, editing);
      const response = await adminRequest<{ product: AdminProduct }>(
        editing ? `/api/admin/products/${encodeURIComponent(productId!)}` : "/api/admin/products",
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) },
      );
      let savedProduct = response.product;
      if (imageFile) {
        const upload = new FormData();
        upload.set("file", imageFile);
        const imageResponse = await adminRequest<{ product: AdminProduct; imageUrl: string }>(`/api/admin/products/${encodeURIComponent(savedProduct.id)}/image`, { method: "POST", body: upload });
        savedProduct = imageResponse.product;
      }
      setProduct(savedProduct);
      setForm(toForm(savedProduct));
      setImageFile(null);
      setSuccess(imageFile ? "Product and image saved." : "Product saved.");
      if (!editing) router.replace(`/admin/products/${encodeURIComponent(savedProduct.id)}`);
      router.refresh();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function removeImage() {
    if (!product) { setImageFile(null); update("imageUrl", ""); return; }
    setRemovingImage(true);
    setError("");
    try {
      const response = await adminRequest<{ product: AdminProduct; imageUrl: null }>(`/api/admin/products/${encodeURIComponent(product.id)}/image`, { method: "DELETE" });
      setProduct(response.product);
      setForm(toForm(response.product));
      setImageFile(null);
      setSuccess("Uploaded image removed.");
    } catch (removeError) {
      setError(errorMessage(removeError));
    } finally {
      setRemovingImage(false);
    }
  }

  if (loading) return <><PageHeading eyebrow="Catalog operations" title="Edit product" description="Loading the product record…" /><div className="admin-panel"><LoadingState /></div></>;
  if (editing && !product && error) return <><PageHeading eyebrow="Catalog operations" title="Product unavailable" description="The record could not be loaded." /><div className="admin-panel"><ErrorState message={error} onRetry={() => void load()} /></div></>;

  return (
    <>
      <PageHeading
        eyebrow="Catalog operations"
        title={editing ? `Edit ${product?.name ?? "product"}` : "Create product"}
        description="Keep product data concise and accurate. Drafts remain private until you explicitly publish them."
        actions={<Link className="admin-button admin-button--secondary" href="/admin/products">Back to products</Link>}
      />
      {error ? <div className="admin-alert" role="alert"><AlertCircle size={15} /> {error}</div> : null}
      {success ? <div className="admin-alert" data-tone="success" role="status"><CheckCircle2 size={15} /> {success}</div> : null}

      <form onSubmit={submit} className="admin-form-shell">
        <div>
          <section className="admin-form-section">
            <h2>Product details</h2><p>The name, SKU, category, and description shown to customers.</p>
            <div className="admin-form-grid">
              <label className="admin-field"><span>Name</span><input required maxLength={160} value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. 600 V differential probe" /></label>
              <label className="admin-field"><span>SKU</span><input required maxLength={80} value={form.sku} onChange={(event) => update("sku", event.target.value)} placeholder="TH-PROBE-600" /></label>
              <label className="admin-field"><span>Slug</span><input maxLength={180} value={form.slug} onChange={(event) => update("slug", event.target.value)} placeholder="Generated from name when blank" /><small>Lowercase URL identifier. Leave blank on create to generate it.</small></label>
              <label className="admin-field"><span>Category</span><input required maxLength={100} value={form.category} onChange={(event) => update("category", event.target.value)} placeholder="Test & measurement" /></label>
              <label className="admin-field admin-field--wide"><span>Description</span><textarea maxLength={4000} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="What it is, the relevant range, and who it is for." /></label>
              <label className="admin-field admin-field--wide"><span>Supplier or source URL</span><input type="url" value={form.sourceUrl} onChange={(event) => update("sourceUrl", event.target.value)} placeholder="https://supplier.example/product" /><small>Internal sourcing reference or manufacturer page.</small></label>
            </div>
          </section>

          <section className="admin-form-section">
            <h2>Price and availability</h2><p>Customer-facing price, stock state, and publication controls.</p>
            <div className="admin-form-grid">
              <label className="admin-field"><span>Price</span><span className="admin-input-prefix"><span>$</span><input required inputMode="decimal" value={form.price} onChange={(event) => update("price", event.target.value)} placeholder="0.00" /></span></label>
              <label className="admin-field"><span>Currency</span><select value={form.currency} onChange={(event) => update("currency", event.target.value)}><option value="usd">USD</option><option value="cad">CAD</option><option value="eur">EUR</option><option value="gbp">GBP</option></select></label>
              <label className="admin-field"><span>Stock status</span><select value={form.stockStatus} onChange={(event) => update("stockStatus", event.target.value as StockStatus)}><option value="in_stock">In stock</option><option value="backorder">Backorder</option><option value="out_of_stock">Out of stock</option><option value="discontinued">Discontinued</option></select></label>
              <label className="admin-field"><span>Stock quantity</span><input type="number" min="0" step="1" value={form.stockQuantity} onChange={(event) => update("stockQuantity", event.target.value)} placeholder="Optional" /></label>
              <label className="admin-field"><span>Publication</span><select value={form.status} onChange={(event) => update("status", event.target.value as ProductStatus)}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
              <label className="admin-check-row"><input type="checkbox" checked={form.featured} onChange={(event) => update("featured", event.target.checked)} /><span>Feature this product in storefront merchandising.</span></label>
            </div>
          </section>
          <div className="admin-form-actions"><Link className="admin-button admin-button--secondary" href="/admin/products">Cancel</Link><button className="admin-button" type="submit" disabled={saving}>{saving ? <LoaderCircle className="admin-spin" size={15} /> : <Save size={15} />}{saving ? "Saving…" : editing ? "Save changes" : "Create product"}</button></div>
        </div>

        <aside className="admin-side-stack">
          <section className="admin-side-card">
            <h2>Primary image</h2><p>Upload a clean product image. It is stored privately and served through the product image endpoint.</p>
            <div className="admin-image-preview">{displayImage ? <img src={displayImage} alt="Product preview" /> : <span className="admin-image-placeholder"><ImagePlus size={25} /> No image selected</span>}</div>
            <label className="admin-file-picker"><input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={chooseImage} /></label>
            {imageMeta ? <p className="admin-upload-meta">{imageMeta}</p> : null}
            {displayImage ? <button className="admin-button admin-button--danger" type="button" disabled={removingImage} onClick={() => void removeImage()}><Trash2 size={14} /> {removingImage ? "Removing…" : "Remove image"}</button> : null}
          </section>
          <section className="admin-side-card">
            <h2>External image URL</h2><p>Secondary fallback for supplier-hosted imagery. Prefer an uploaded image for durable catalog presentation.</p>
            <label className="admin-field"><span>Image URL</span><input type="url" value={form.imageUrl} onChange={(event) => update("imageUrl", event.target.value)} placeholder="https://…" /></label>
          </section>
        </aside>
      </form>
    </>
  );
}

function productPayload(form: ProductFormState, editing: boolean): Record<string, unknown> {
  const price = Number.parseFloat(form.price);
  if (!Number.isFinite(price) || price < 0) throw new Error("Enter a valid non-negative price.");
  const quantity = form.stockQuantity.trim() ? Number.parseInt(form.stockQuantity, 10) : undefined;
  if (quantity !== undefined && (!Number.isInteger(quantity) || quantity < 0)) throw new Error("Stock quantity must be a whole number of zero or more.");
  return {
    name: form.name.trim(),
    ...(form.slug.trim() || editing ? { slug: form.slug.trim() } : {}),
    sku: form.sku.trim(),
    description: form.description.trim(),
    category: form.category.trim(),
    priceCents: Math.round(price * 100),
    currency: form.currency,
    stockStatus: form.stockStatus,
    ...(quantity === undefined ? {} : { stockQuantity: quantity }),
    imageUrl: form.imageUrl.trim() || null,
    sourceUrl: form.sourceUrl.trim() || null,
    featured: form.featured,
    status: form.status,
  };
}

function toForm(product: AdminProduct): ProductFormState {
  return {
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description ?? "",
    category: product.category,
    price: (product.priceCents / 100).toFixed(2),
    currency: product.currency,
    stockStatus: product.stockStatus,
    stockQuantity: product.stockQuantity == null ? "" : String(product.stockQuantity),
    sourceUrl: product.sourceUrl ?? "",
    imageUrl: product.imageR2Key ? "" : product.imageUrl ?? "",
    status: product.status,
    featured: product.featured,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
