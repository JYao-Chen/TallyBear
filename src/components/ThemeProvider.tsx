'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {useI18n} from './LanguageProvider';
import {themes,type Theme} from '@/lib/themes';
const ThemeContext=createContext<{theme:Theme;setTheme:(theme:Theme)=>void}>({theme:'bear',setTheme:()=>{}});
export const useTheme=()=>useContext(ThemeContext);
export function ThemeProvider({initial,children}:{initial:Theme;children:ReactNode}){const {t:tr,locale}=useI18n();const [theme,setTheme]=useState<Theme>(initial);useEffect(()=>{document.documentElement.dataset.theme=theme;document.cookie=`bubu_theme=${theme};path=/;max-age=31536000;SameSite=Lax${location.protocol==='https:'?';Secure':''}`;document.title=tr(themes[theme].name);document.querySelector('link[rel="icon"]')?.setAttribute('href',themes[theme].icon);document.querySelector('meta[name="theme-color"]')?.setAttribute('content',themes[theme].color);document.querySelector('link[rel="manifest"]')?.setAttribute('href',locale==='en'?themes[theme].manifest.replace('.webmanifest','-en.webmanifest'):themes[theme].manifest);},[theme,locale]);return <ThemeContext.Provider value={{theme,setTheme}}>{children}</ThemeContext.Provider>;}
