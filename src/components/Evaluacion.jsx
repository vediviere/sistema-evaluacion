import { useState, useEffect, useRef } from "react";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import IconButton from "@mui/material/IconButton";
import "./Evaluacion.css";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  Container,
  Grid,
  Paper,
  Typography,
  TextField,
  MenuItem,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
} from "@mui/material";

function Evaluacion() {
  const [evaluador, setEvaluador] = useState("");
  const [evaluadoNombre, setEvaluadoNombre] = useState("");
  const [numeroCartel, setNumeroCartel] = useState("");
  const [tipoEvaluacion, setTipoEvaluacion] = useState("equipo");
  const [carrera, setCarrera] = useState("");
  const [criterios, setCriterios] = useState(new Array(10).fill(""));
  const [mensaje, setMensaje] = useState("");
  const [lista, setLista] = useState([]);
  const [filtro, setFiltro] = useState("todos");
  const [filtroCarrera, setFiltroCarrera] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [idEliminar, setIdEliminar] = useState(null);
  const formularioRef = useRef(null);
  const criteriosRef = useRef([]);
  const [tipoMensaje, setTipoMensaje] = useState("success");

  const manejarCambio = (index, value) => {
    let numero = value.replace(/\D/g, ""); // solo números

    if (numero.length > 2) {
      numero = numero.slice(0, 2);
    }

    const valorNumerico = Number(numero);

    if (valorNumerico > 10) {
      numero = "10";
    }

    const nuevosCriterios = [...criterios];
    nuevosCriterios[index] = numero;
    setCriterios(nuevosCriterios);
  };

  const calcularTotal = () => {
    return criterios.reduce((acc, val) => acc + Number(val || 0), 0);
  };

  const guardarEvaluacion = async () => {
    if (!evaluadoNombre.trim().toLowerCase()) {
      setMensaje("El nombre del evaluado es obligatorio");
      return;
    }
    if (!numeroCartel.trim().toLowerCase()) {
      setMensaje("El número de cartel es obligatorio");
      return;
    }
    if (!carrera.trim().toLowerCase()) {
      setMensaje("La carrera es obligatoria");
      return;
    }
    if (!evaluador.trim().toLowerCase()) {
      setMensaje("El evaluador es obligatorio");
      return;
    }

    for (let i = 0; i < criterios.length; i++) {
      const valor = Number(criterios[i]);
      if (criterios[i] === "") {
        setMensaje(`Falta capturar el criterio ${i + 1}`);
        return;
      }
      if (valor < 0 || valor > 10) {
        setMensaje(`El criterio ${i + 1} debe estar entre 0 y 10`);
        return;
      }
    }

    // 🔥 Protección si el documento ya no existe
    if (editandoId && !lista.find((item) => item.id === editandoId)) {
      setEditandoId(null);
    }

    // 🔒 Validar número de cartel duplicado en la misma carrera (ANTES de guardar)
    const cartelExiste = lista.some(
      (r) =>
        r.numeroCartel === numeroCartel &&
        r.carrera?.toLowerCase() === carrera.trim().toLowerCase() &&
        r.id !== editandoId,
    );

    if (cartelExiste) {
      setMensaje("Ya existe ese número de cartel en esta carrera");
      setTipoMensaje("error");
      setOpenSnackbar(true);
      return;
    }

    try {
      const datosGuardar = {
        tipoEvaluacion,
        evaluadoNombre,
        numeroCartel,
        carrera: carrera.trim().toLowerCase(),
        evaluador,
        criterios,
        total: calcularTotal(),
        fecha: new Date(),
      };

      if (editandoId) {
        await updateDoc(doc(db, "evaluaciones", editandoId), datosGuardar);
        setEditandoId(null);
      } else {
        await addDoc(collection(db, "evaluaciones"), datosGuardar);
      }

      setMensaje("Evaluación guardada ✅");
      setTipoMensaje("success");
      setOpenSnackbar(true);
      setEvaluador("");
      setEvaluadoNombre("");
      setNumeroCartel("");
      setCarrera("");
      setCriterios(new Array(10).fill(""));
    } catch (error) {
      setMensaje("Error al guardar ❌", error);
      setTipoMensaje("error");
      setOpenSnackbar(true);
    }

    criteriosRef.current[0]?.focus();
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "evaluaciones"),
      (snapshot) => {
        const datos = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setLista(datos);
      },
    );

    return () => unsubscribe();
  }, []);

  const rankingFiltrado = () => {
    // 🔥 1. Ranking general completo
    const rankingGeneral = [...lista]
      .sort((a, b) => b.total - a.total)
      .map((item, index) => ({
        ...item,
        posicion: index + 1,
      }));

    let datos = [...rankingGeneral];

    // 🔹 Filtro por tipo
    if (filtro === "equipo") {
      datos = datos.filter((item) => item.tipoEvaluacion === "equipo");
    }

    if (filtro === "alumno") {
      datos = datos.filter((item) => item.tipoEvaluacion === "alumno");
    }

    // 🔹 Filtro por carrera
    if (filtroCarrera !== "Todas") {
      datos = datos.filter(
        (item) => item.carrera?.toLowerCase() === filtroCarrera.toLowerCase(),
      );
    }

    // 🔹 Buscador
    if (busqueda.trim() !== "") {
      const texto = busqueda.toLowerCase();

      datos = datos.filter(
        (item) =>
          item.evaluadoNombre?.toLowerCase().includes(texto) ||
          item.numeroCartel?.toString().includes(texto) ||
          item.evaluador?.toLowerCase().includes(texto),
      );
    }

    return datos;
  };

  const obtenerCarreras = () => {
    const carreras = lista.map((item) => item.carrera);
    return ["Todas", ...new Set(carreras)];
  };

  const exportarExcel = () => {
    const datosOrdenados = rankingFiltrado().map((item) => ({
      Posicion: item.posicion,
      Nombre: item.evaluadoNombre,
      Cartel: item.numeroCartel,
      Carrera: item.carrera,
      Evaluador: item.evaluador,
      Total: item.total,
    }));

    const worksheet = XLSX.utils.json_to_sheet(datosOrdenados);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Resultados");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const data = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });

    saveAs(data, "Resultados_Evaluacion.xlsx");
  };

  const confirmarEliminar = (id) => {
    setIdEliminar(id);
    setOpenDelete(true);
  };

  const eliminarEvaluacion = async () => {
    try {
      await deleteDoc(doc(db, "evaluaciones", idEliminar));

      // 🔥 Si estoy eliminando el que estoy editando
      if (editandoId === idEliminar) {
        setEditandoId(null);
        setEvaluador("");
        setEvaluadoNombre("");
        setNumeroCartel("");
        setCarrera("");
        setCriterios(new Array(10).fill(""));
      }

      setOpenDelete(false);
      setIdEliminar(null);

      setMensaje("Evaluación eliminada 🗑️");
      setTipoMensaje("info");
      setOpenSnackbar(true);
    } catch (error) {
      console.error(error);
    }
  };

  const cargarParaEditar = (item) => {
    setEvaluador(item.evaluador || "");
    setEvaluadoNombre(item.evaluadoNombre || "");
    setNumeroCartel(item.numeroCartel || "");
    setCarrera(item.carrera || "");
    setTipoEvaluacion(item.tipoEvaluacion || "equipo");
    setCriterios(item.criterios || new Array(10).fill(""));
    setEditandoId(item.id);

    setTimeout(() => {
      if (formularioRef.current) {
        formularioRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 100);
  };

  const manejarEnterCriterio = (e, index) => {
    if (e.key === "Enter") {
      e.preventDefault();

      const siguiente = criteriosRef.current[index + 1];

      if (siguiente) {
        siguiente.focus();
      } else {
        guardarEvaluacion(); // 🔥 Si es el último criterio, guarda
      }
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Sistema de Evaluación
      </Typography>

      <Paper elevation={3} sx={{ p: 3, mb: 4 }} ref={formularioRef}>
        <Typography
          variant="h6"
          gutterBottom
          sx={{
            backgroundColor: "#1976d2",
            color: "white",
            padding: 1,
            borderRadius: 1,
          }}
        >
          Captura de Evaluación
        </Typography>
        <br />

        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              select
              fullWidth
              label="Tipo"
              value={tipoEvaluacion}
              onChange={(e) => setTipoEvaluacion(e.target.value)}
            >
              <MenuItem value="equipo">Equipo</MenuItem>
              <MenuItem value="alumno">Alumno</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label={
                tipoEvaluacion === "equipo"
                  ? "Nombre del equipo"
                  : "Nombre del alumno"
              }
              value={evaluadoNombre}
              onChange={(e) => setEvaluadoNombre(e.target.value)}
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="No. Cartel"
              value={numeroCartel}
              onChange={(e) => setNumeroCartel(e.target.value)}
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Carrera"
              value={carrera}
              onChange={(e) => setCarrera(e.target.value)}
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Nombre del evaluador"
              value={evaluador}
              onChange={(e) => setEvaluador(e.target.value)}
            />
          </Grid>

          {criterios.map((valor, index) => (
            <Grid item xs={6} md={2} key={`c${index + 1}`}>
              <TextField
                type="number"
                fullWidth
                label={`Criterio ${index + 1}`}
                value={valor}
                inputRef={(el) => (criteriosRef.current[index] = el)}
                onKeyDown={(e) => manejarEnterCriterio(e, index)}
                onChange={(e) => manejarCambio(index, e.target.value)}
                sx={{
                  "& input": {
                    textAlign: "center",
                  },
                  "& input::-webkit-outer-spin-button": {
                    WebkitAppearance: "none",
                    margin: 0,
                  },
                  "& input::-webkit-inner-spin-button": {
                    WebkitAppearance: "none",
                    margin: 0,
                  },
                  "& input[type=number]": {
                    MozAppearance: "textfield",
                  },
                }}
              />
            </Grid>
          ))}

          <Grid item xs={12} md={4}>
            <Typography variant="h6">Total: {calcularTotal()}</Typography>
          </Grid>

          <Grid item xs={12} md={4}>
            <Button variant="contained" fullWidth onClick={guardarEvaluacion}>
              {editandoId ? "Actualizar Evaluación" : "Guardar Evaluación"}
            </Button>
          </Grid>

          {mensaje && (
            <Grid item xs={12}>
              <Typography color="error">{mensaje}</Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography
          variant="h6"
          gutterBottom
          sx={{
            backgroundColor: "#1976d2",
            color: "white",
            padding: 1,
            borderRadius: 1,
          }}
        >
          Evaluaciones Guardadas
        </Typography>
        <br />

        <Grid container spacing={2} sx={{ mb: 2 }}>
          {/* Filtro Tipo */}
          <Grid item xs={12} md={3}>
            <TextField
              select
              fullWidth
              label="Ver"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            >
              <MenuItem value="todos">Todos</MenuItem>
              <MenuItem value="equipo">Equipos</MenuItem>
              <MenuItem value="alumno">Alumnos</MenuItem>
            </TextField>
          </Grid>

          {/* Filtro Carrera */}
          <Grid item xs={12} md={3}>
            <TextField
              select
              fullWidth
              label="Carrera"
              value={filtroCarrera}
              onChange={(e) => setFiltroCarrera(e.target.value)}
            >
              {obtenerCarreras().map((carrera) => (
                <MenuItem key={carrera} value={carrera}>
                  {carrera}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* Buscador */}
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Buscar..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <Button
              variant="outlined"
              sx={{ mt: 2, ml: 2 }}
              onClick={exportarExcel}
            >
              Exportar a Excel
            </Button>
          </Grid>
        </Grid>

        <Table>
          <TableHead sx={{ backgroundColor: "#1976d2" }}>
            <TableRow>
              <TableCell sx={{ color: "white" }}>POSICIÓN</TableCell>
              <TableCell sx={{ color: "white" }}>TIPO</TableCell>
              <TableCell sx={{ color: "white" }}>NOMBRE</TableCell>
              <TableCell sx={{ color: "white" }}>NO. CARTEL</TableCell>
              <TableCell sx={{ color: "white" }}>CARRERA</TableCell>
              <TableCell sx={{ color: "white" }}>EVALUADOR</TableCell>
              <TableCell sx={{ color: "white" }}>TOTAL</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rankingFiltrado().map((item) => {
              let estiloFila = {};

              if (item.posicion === 1) {
                estiloFila = { backgroundColor: "#FFD70055" }; // Oro
              } else if (item.posicion === 2) {
                estiloFila = { backgroundColor: "#C0C0C055" }; // Plata
              } else if (item.posicion === 3) {
                estiloFila = { backgroundColor: "#CD7F3255" }; // Bronce
              }

              return (
                <TableRow
                  key={item.id}
                  sx={{
                    ...estiloFila,
                    "&:hover": {
                      backgroundColor: "#f5f5f5",
                      transition: "0.2s",
                    },
                  }}
                >
                  <TableCell>
                    {item.posicion === 1 && "🥇 "}
                    {item.posicion === 2 && "🥈 "}
                    {item.posicion === 3 && "🥉 "}
                    {item.posicion}
                  </TableCell>
                  <TableCell>{item.tipoEvaluacion}</TableCell>
                  <TableCell>{item.evaluadoNombre}</TableCell>
                  <TableCell>{item.numeroCartel}</TableCell>
                  <TableCell>{item.carrera}</TableCell>
                  <TableCell>{item.evaluador}</TableCell>
                  <TableCell>
                    <strong>{item.total}</strong>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Editar">
                      <span>
                        <IconButton
                          color="primary"
                          onClick={() => cargarParaEditar(item)}
                          disabled={editandoId === item.id}
                        >
                          <EditIcon />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip title="Eliminar">
                      <IconButton
                        color="error"
                        onClick={() => confirmarEliminar(item.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      <Snackbar
        open={openSnackbar}
        autoHideDuration={3000}
        onClose={() => setOpenSnackbar(false)}
      >
        <Alert
          onClose={() => setOpenSnackbar(false)}
          severity={tipoMensaje}
          sx={{ width: "100%" }}
        >
          {mensaje}
        </Alert>
      </Snackbar>

      <Dialog open={openDelete} onClose={() => setOpenDelete(false)}>
        <DialogTitle>Confirmar Eliminación</DialogTitle>
        <DialogContent>
          ¿Estás seguro que deseas eliminar esta evaluación?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDelete(false)}>Cancelar</Button>
          <Button
            color="error"
            variant="contained"
            onClick={eliminarEvaluacion}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default Evaluacion;
