import { LanguageSwitcher } from "@/components/language-switcher";
import { publicRestaurant } from "@/lib/restaurant-api";

export default async function RestaurantLayout({ children, params }: LayoutProps<"/r/[slug]">) {
  const { slug } = await params;
  await publicRestaurant(slug);
  return <>
    <div className="mx-auto flex max-w-6xl justify-end px-4 pt-4 sm:px-8"><LanguageSwitcher /></div>
    {children}
  </>;
}
