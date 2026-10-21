'use client';
import {createContext,useContext} from 'react';
import type {LedgerRow} from '@/lib/ledger-types';
export const EntryDetailContext=createContext<((row:LedgerRow)=>void)|null>(null);
export function useEntryDetail(){return useContext(EntryDetailContext);}
