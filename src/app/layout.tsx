import './globals.css';
import './mobile-refinement.css';
import './desktop-refinement.css';
import './chat.css';
import {MobileViewport} from '@/components/MobileViewport';
import {LanguageProvider} from '@/components/LanguageProvider';
import {language,translate} from '@/lib/i18n';
import {deployment} from '@/lib/deployment';
import {checkDeploymentCurrency} from '@/server/deployment';
import {cookies} from 'next/headers';
import {ThemeProvider} from '@/components/ThemeProvider';
import {validTheme,themes} from '@/lib/themes';
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#faf7f2'};
export async function generateMetadata(){const theme=validTheme((await cookies()).get('bubu_theme')?.value);const locale=deployment().language;return {title:translate(themes[theme].name,locale),description:locale==='en'?'AI-assisted personal and family bookkeeping':'智能个人与家庭账本',manifest:locale==='en'?themes[theme].manifest.replace('.webmanifest','-en.webmanifest'):themes[theme].manifest,icons:{icon:themes[theme].icon}};}
export default async function Layout({children}: {children:React.ReactNode}) { const theme=validTheme((await cookies()).get('bubu_theme')?.value);const locale=deployment().language;const config=await checkDeploymentCurrency();return <html lang={locale} data-theme={theme} data-currency={config.currency}><head><link rel="stylesheet" href="/fonts/wenkai.css"/></head><body><MobileViewport/><LanguageProvider initial={locale} currency={config.currency}><ThemeProvider initial={theme}>{children}</ThemeProvider></LanguageProvider></body></html>; }
