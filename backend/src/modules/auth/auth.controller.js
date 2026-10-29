function criarAuthController({ authService }) {
  async function login(req, res) {
    res.json(await authService.login(req.validado.body));
  }

  // req.usuario foi preenchido pelo middleware autenticar
  async function eu(req, res) {
    res.json(await authService.eu(req.usuario.id));
  }

  return { login, eu };
}

module.exports = { criarAuthController };
