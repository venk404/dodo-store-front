import Header, { Business } from "@/components/header";
import { ProductGrid } from "@/components/product/ProductGrid";
import Banner from "@/components/ui/dodoui/banner";
import { ProductCardProps } from "@/components/product/ProductCard";
import { headers } from "next/headers";
import {
  getCheckoutBaseUrl,
  resolveModeFromHost,
} from "@/lib/server/resolve-storefront";
import {
  getBusiness,
  getProducts,
  isUpstreamHttpError,
} from "@/lib/server/storefront-client";
import { redirect } from "next/navigation";

async function getData(slug: string) {
  const h = await headers();
  const mode = resolveModeFromHost(h);
  const checkoutBaseUrl = getCheckoutBaseUrl(mode);

  try {
    const [business, productsJson, subsJson] = await Promise.all([
      getBusiness(mode, slug),
      getProducts(mode, slug, { recurring: false, page_size: 100 }),
      getProducts(mode, slug, { recurring: true, page_size: 100 }),
    ]);

    const businessData: Business = business;

    const products: ProductCardProps[] = productsJson.items.map((product) => ({
      product_id: product.product_id,
      name: product.name,
      image: product.image || undefined,
      price: product.price,
      pay_what_you_want: product.price_detail?.pay_what_you_want,
      description: product.description || "",
      currency: product.currency,
    }));

    const subscriptions: ProductCardProps[] = subsJson.items.map((subscription) => ({
      product_id: subscription.product_id,
      name: subscription.name,
      image: subscription.image || undefined,
      price: subscription.price,
      description: subscription.description || "",
      currency: subscription.currency,
      payment_frequency_count: subscription.price_detail?.payment_frequency_count,
      payment_frequency_interval: subscription.price_detail?.payment_frequency_interval,
      trial_period_days: subscription.price_detail?.trial_period_days,
    }));

    return {
      business: businessData,
      products,
      subscriptions,
      mode,
      checkoutBaseUrl,
    } as const;
  } catch (err) {
    if (isUpstreamHttpError(err) && err.statusCode === 404) {
      return { notFound: true as const };
    }

    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  try {
    const h = await headers();
    const mode = resolveModeFromHost(h);
    const { slug } = await params;
    const business = await getBusiness(mode, slug);
    return { title: business.name ?? "Dodo Payments" };
  } catch (err) {
    if (isUpstreamHttpError(err) && err.statusCode === 404) {
      return { title: "Dodo Payments" };
    }

    return { title: "Dodo Payments" };
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getData(slug);
  if ("notFound" in data) return redirect("/not-found");

  const { business, products, subscriptions, mode, checkoutBaseUrl } = data;

  return (
    <main className="min-h-screen bg-bg-primary">
      <Banner mode={mode} />
      <Header business={business} />
      <section className="flex flex-col pb-20 items-center max-w-[1145px] mx-auto justify-center mt-10 px-4">
        {products.length > 0 && (
          <ProductGrid
            title="Products"
            products={products}
            checkoutBaseUrl={checkoutBaseUrl}
          />
        )}

        {subscriptions.length > 0 && (
          <div className="mt-8 w-full">
            <ProductGrid
              title="Subscriptions"
              products={subscriptions}
              checkoutBaseUrl={checkoutBaseUrl}
            />
          </div>
        )}
      </section>
    </main>
  );
}
