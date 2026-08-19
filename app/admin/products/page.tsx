"use client";

import Link from "../../components/native-link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Edit3, Plus, Search, Send } from "lucide-react";
import { adminRequest, errorMessage, money, shortDate } from "../admin-api";
import { EmptyState, ErrorState, LoadingState, PageHeading, StatusBadge } from "../admin-components";
import type { AdminProduct, ProductStatus } from "../admin-types";

export default function ProductsPage() {
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ProductStatus>("all");
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await adminRequest<{ products: AdminProduct[] }>("/api/admin/products");
      setProducts(response.products);
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (products ?? []).filter((product) => {
      const matchesQuery = !needle || [product.name, product.sku, product.slug, product.category].some((value) => value.toLowerCase().includes(needle));
      return matchesQuery && (status === "all" || product.status === status);
    });
  }, [products, query, status]);

  async function publish(product: AdminProduct) {
    setWorkingId(product.id);
    setError("");
    try {
      const response = await adminRequest<{ product: AdminProduct }>(`/api/admin/products/${encodeURIComponent(product.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "published" }),
      });
      setProducts((current) => current?.map((item) => item.id === product.id ? response.product : item) ?? null);
    } catch (publishError) {
      setError(errorMessage(publishError));
    } finally {
      setWorkingId("");
    }
  }

  async function archive(product: AdminProduct) {
    if (!window.confirm(`Archive ${product.name}? It will be removed from the public catalog but kept in admin.`)) return;
    setWorkingId(product.id);
    setError("");
    try {
      await adminRequest(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: "DELETE" });
      setProducts((current) => current?.map((item) => item.id === product.id ? { ...item, status: "archived" } : item) ?? null);
    } catch (archiveError) {
      setError(errorMessage(archiveError));
    } finally {
      setWorkingId("");
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Catalog operations"
        title="Products"
        description="Create, price, publish, and archive the hardware shown in the storefront."
        actions={<Link className="admin-button" href="/admin/products/new"><Plus size={15} /> New product</Link>}
      />
      {error ? <div className="admin-alert" role="alert">{error}</div> : null}
      <div className="admin-filter-bar">
        <div className="admin-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, SKU, slug, or category" aria-label="Search products" /></div>
        <div className="admin-filter-field"><label htmlFor="product-status">Publication</label><select id="product-status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></div>
      </div>

      <section className="admin-panel">
        {!products && !error ? <LoadingState label="Loading catalog…" /> : null}
        {!products && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {products && !filtered.length ? <EmptyState title="No matching products" detail="Change the filters or create a new catalog record." /> : null}
        {products && filtered.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Publication</th><th>Updated</th><th><span className="admin-sr-only">Actions</span></th></tr></thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id}>
                    <td><div className="admin-product-cell"><span className="admin-product-thumb">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : product.name.slice(0, 1)}</span><span><strong>{product.name}</strong><small>/{product.slug}</small></span></div></td>
                    <td><code>{product.sku}</code></td>
                    <td>{product.category}</td>
                    <td><strong>{money(product.priceCents, product.currency)}</strong></td>
                    <td><StatusBadge value={product.stockStatus} /></td>
                    <td><StatusBadge value={product.status} /></td>
                    <td>{shortDate(product.updatedAt)}</td>
                    <td><div className="admin-table-actions">
                      <Link className="admin-icon-button" href={`/admin/products/${encodeURIComponent(product.id)}`} aria-label={`Edit ${product.name}`} title="Edit"><Edit3 size={14} /></Link>
                      {product.status !== "published" ? <button className="admin-icon-button" type="button" disabled={workingId === product.id} onClick={() => void publish(product)} aria-label={`Publish ${product.name}`} title="Publish"><Send size={14} /></button> : null}
                      {product.status !== "archived" ? <button className="admin-icon-button" type="button" disabled={workingId === product.id} onClick={() => void archive(product)} aria-label={`Archive ${product.name}`} title="Archive"><Archive size={14} /></button> : null}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}
