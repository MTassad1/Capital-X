// Só deixa passar quem está logado e com a conta verificada pelo código.
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase-init.js";

export function exigirLogin(volta) {
  const irParaLogin = () =>
    location.assign(`login.html?volta=${encodeURIComponent(volta)}`);
  return new Promise((resolve) => {
    if (!auth) { irParaLogin(); return; }
    const parar = onAuthStateChanged(auth, async (user) => {
      parar();
      if (!user) { irParaLogin(); return; }
      const { claims } = await user.getIdTokenResult();
      if (claims.codigoVerificado !== true) { irParaLogin(); return; }
      resolve(user);
    });
  });
}
