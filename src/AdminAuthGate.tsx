import { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import Admin from './Admin';
import AdminCatalogControl from './AdminCatalogControl';

// O restante do componente permanece inalterado; a rota específica do catálogo é
// resolvida antes de montar o Admin monolítico, mantendo o painel isolado.

/* __CAPITAO_ADMIN_GATE_PRESERVE__ */
