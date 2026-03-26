"use client"

import { useState, useEffect } from "react"
import getSymbolFromCurrency from "currency-symbol-map"
import { STORAGE_KEYS } from "@/lib/constants"

/**
 * SSR-safe hook for reading the user's preferred currency from localStorage.
 * Returns { currency, currencySymbol, loading }.
 */
export function useCurrency(fallback = "USD") {
  const [currency, setCurrency] = useState(fallback)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.DEFAULT_CURRENCY)
    if (stored) setCurrency(stored)
    setLoading(false)
  }, [])

  const currencySymbol = getSymbolFromCurrency(currency) || "$"

  return { currency, currencySymbol, loading }
}
