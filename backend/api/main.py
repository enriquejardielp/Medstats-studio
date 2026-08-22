from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import pandas as pd
import base64
import json
import os
from io import StringIO, BytesIO
from datetime import datetime
from sqlalchemy.orm import Session

from backend.core.r_bridge import RBridge
from backend.core.data_utils import clean_uploaded_dataframe
from backend.database import engine, get_db, Base
from backend.models import User, Project
from backend import schemas
from backend.auth import get_current_user
from backend.api.auth_routes import router as auth_router

app = FastAPI(title="MedStats Studio API", version="2.1.0")

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=400,
        content={"detail": f"Error al ejecutar el análisis: {exc}"},
    )

# Configuración de CORS
cors_origins_env = os.environ.get("CORS_ORIGINS", "")
if cors_origins_env:
    allowed_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
else:
    allowed_origins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8000"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if "*" not in allowed_origins else ["*"],
    allow_origin_regex=os.environ.get("CORS_ORIGIN_REGEX", r"https://.*\.onrender\.com"),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir las rutas de autenticación
app.include_router(auth_router)

@app.get("/")
def root():
    return {
        "status": "online",
        "app": "MedStats Studio API",
        "version": "2.1.0",
        "docs": "/docs"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# ------------------------------------------------------------
# INICIALIZACIÓN DE LA BASE DE DATOS
# ------------------------------------------------------------
Base.metadata.create_all(bind=engine)

# ------------------------------------------------------------
# MODELOS DE PETICIÓN (ANÁLISIS)
# ------------------------------------------------------------

class ShapiroRequest(BaseModel):
    values: List[float]

class CompareRequest(BaseModel):
    group1: List[float]
    group2: List[float]
    paired: bool = False
    method: str = "welch"
    conf_level: float = 0.95

class CorrelationRequest(BaseModel):
    series1: List[float]
    series2: List[float]
    method: str = "auto"
    conf_level: float = 0.95

class ChiSquareRequest(BaseModel):
    var1: List[str]
    var2: List[str]

class LinearRegressionProjectRequest(BaseModel):
    project_id: int
    dep_var: str
    indep_vars: List[str]
    conf_level: float = 0.95

class LogisticRegressionProjectRequest(BaseModel):
    project_id: int
    dep_var: str
    indep_vars: List[str]
    conf_level: float = 0.95

class AnovaProjectRequest(BaseModel):
    project_id: int
    dep_var: str
    group_var: str
    subject_var: Optional[str] = None
    repeated: bool = False
    method: str = "auto"
    conf_level: float = 0.95

class ZTestRequest(BaseModel):
    values: List[float]
    mu: float = 0.0

class FriedmanProjectRequest(BaseModel):
    project_id: int
    columns: List[str]

class KolmogorovSmirnovRequest(BaseModel):
    series1: List[float]
    series2: List[float]

class McNemarProjectRequest(BaseModel):
    project_id: int
    var1: str
    var2: str

class OddsRatioProjectRequest(BaseModel):
    project_id: int
    var1: str
    var2: str

class KappaProjectRequest(BaseModel):
    project_id: int
    var1: str
    var2: str

class RocCurveProjectRequest(BaseModel):
    project_id: int
    outcome: str
    predictor: str

class DiagnosticAccuracyProjectRequest(BaseModel):
    project_id: int
    outcome: str
    predictor: str
    threshold: float

class KaplanMeierProjectRequest(BaseModel):
    project_id: int
    time_var: str
    event_var: str
    group_var: Optional[str] = None

class CoxRegressionProjectRequest(BaseModel):
    project_id: int
    time_var: str
    event_var: str
    covariates: List[str]

class BlandAltmanProjectRequest(BaseModel):
    project_id: int
    var1: str
    var2: str

class ICCProjectRequest(BaseModel):
    project_id: int
    columns: List[str]

class AncovaProjectRequest(BaseModel):
    project_id: int
    dep_var: str
    group_var: str
    covariates: List[str]

class PropensityScoreProjectRequest(BaseModel):
    project_id: int
    treatment: str
    covariates: List[str]

class SampleSizeRequest(BaseModel):
    alpha: float
    power: float
    effect: float
    test_type: str = "t-test"

class BonferroniRequest(BaseModel):
    p_values: List[float]

class Table1ProjectRequest(BaseModel):
    project_id: int
    variables: List[str]
    group_var: Optional[str] = None
    decimals: int = 2

class LeveneProjectRequest(BaseModel):
    project_id: int
    dep_var: str
    group_var: str

class KsOneSampleRequest(BaseModel):
    values: List[float]
    dist: str = "pnorm"
    mean: Optional[float] = None
    sd: Optional[float] = None

class ChisqGoodnessOfFitProjectRequest(BaseModel):
    project_id: int
    var: str
    p_null: Optional[List[float]] = None

class BinomialTestRequest(BaseModel):
    successes: int
    trials: int
    p_null: float = 0.5
    alternative: str = "two.sided"

class GraphProjectRequest(BaseModel):
    project_id: int
    graph_type: str
    x_var: str
    y_var: Optional[str] = None
    color_var: Optional[str] = None
    fill_var: Optional[str] = None
    title: str = ""
    xlab: str = ""
    ylab: str = ""
    palette: str = "Set1"
    theme: str = "classic"
    width: int = 8
    height: int = 6
    dpi: int = 300
    bins: int = 30

class DescriptiveRequest(BaseModel):
    project_id: int
    columns: List[str]

# ------------------------------------------------------------
# FUNCIONES AUXILIARES
# ------------------------------------------------------------

def get_project_or_404(db: Session, project_id: int, user: User) -> Project:
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado o no tienes acceso")
    return project

def get_df_from_project(project: Project) -> pd.DataFrame:
    csv_str = project.csv_data
    df = pd.read_csv(StringIO(csv_str))
    if len(df.columns) == 1:
        df = pd.read_csv(StringIO(csv_str), sep=';')
    df.columns = [c.lstrip('\ufeff').strip() for c in df.columns]
    return clean_uploaded_dataframe(df)


def _detect_column_type(series):
    clean = series.dropna()
    if len(clean) == 0:
        return "empty"
    if pd.api.types.is_numeric_dtype(clean):
        unique_vals = clean.unique()
        if len(unique_vals) == 2:
            return "binary"
        elif len(unique_vals) <= 10:
            return "numeric"
        else:
            return "numeric"
    else:
        try:
            pd.to_datetime(clean, errors='raise')
            return "date"
        except:
            pass
        unique_str = set(str(x).upper() for x in clean)
        if unique_str.issubset({'SI', 'NO', '1', '0', 'TRUE', 'FALSE', 'S', 'N'}):
            return "binary"
        return "categorical"

def _sanitize_json(obj):
    if isinstance(obj, dict):
        return {k: _sanitize_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_sanitize_json(v) for v in obj]
    elif isinstance(obj, float):
        if obj != obj or obj == float('inf') or obj == float('-inf'):
            return None
        return obj
    return obj

# ------------------------------------------------------------
# ENDPOINTS DE PROYECTOS (PROTEGIDOS)
# ------------------------------------------------------------

@app.post("/api/projects/", response_model=schemas.ProjectResponse)
def create_project(
    project: schemas.ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    df = pd.read_csv(StringIO(project.csv_data))
    db_project = Project(
        name=project.name,
        description=project.description,
        filename=project.filename,
        csv_data=project.csv_data,
        columns=json.dumps(df.columns.tolist()),
        column_types=json.dumps(project.column_types) if project.column_types else None,
        row_count=len(df),
        owner_id=current_user.id
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    db_project.columns = json.loads(db_project.columns)
    if db_project.column_types:
        db_project.column_types = json.loads(db_project.column_types)
    return db_project

@app.get("/api/projects/", response_model=List[schemas.ProjectResponse])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    projects = db.query(Project).filter(Project.owner_id == current_user.id).all()
    if not projects:
        return []
    for p in projects:
        p.columns = json.loads(p.columns)
        if p.column_types:
            p.column_types = json.loads(p.column_types)
    return projects

@app.get("/api/projects/{project_id}", response_model=schemas.ProjectResponse)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, project_id, current_user)
    project.columns = json.loads(project.columns)
    if project.column_types:
        project.column_types = json.loads(project.column_types)
    return project

@app.delete("/api/projects/{project_id}")
def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, project_id, current_user)
    db.delete(project)
    db.commit()
    return {"message": "Proyecto eliminado"}

@app.post("/api/projects/upload", response_model=schemas.ProjectResponse)
async def create_project_from_file(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    allowed_extensions = {".csv", ".xlsx", ".xls"}
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Formato de archivo no soportado. Usa CSV o Excel.")

    contents = await file.read()
    try:
        if file_ext == ".csv":
            csv_data = contents.decode("utf-8")
        else:
            df_excel = pd.read_excel(BytesIO(contents))
            df_excel = clean_uploaded_dataframe(df_excel)
            csv_data = df_excel.to_csv(index=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al procesar el archivo: {str(e)}")

    try:
        df = pd.read_csv(StringIO(csv_data))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"El archivo no contiene un CSV válido: {str(e)}")

    df = clean_uploaded_dataframe(df)
    csv_data = df.to_csv(index=False)

    db_project = Project(
        name=name,
        description=description,
        filename=file.filename,
        csv_data=csv_data,
        columns=json.dumps(df.columns.tolist()),
        column_types=None,
        row_count=len(df),
        owner_id=current_user.id
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    db_project.columns = json.loads(db_project.columns)
    return db_project

# ------------------------------------------------------------
# ENDPOINTS DE DATOS DEL PROYECTO
# ------------------------------------------------------------

@app.get("/api/projects/{project_id}/data")
def get_project_data(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, project_id, current_user)
    try:
        csv_str = project.csv_data
        csv_str = csv_str.encode('utf-8', errors='replace').decode('utf-8')
        df = pd.read_csv(StringIO(csv_str), sep=None, engine='python')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al leer los datos: {str(e)}")

    types = {}
    for col in df.columns:
        types[col] = _detect_column_type(df[col])

    raw_data = df.to_dict(orient="records")
    clean_data = _sanitize_json(raw_data)

    return {
        "columns": df.columns.tolist(),
        "types": types,
        "data": clean_data,
        "row_count": len(df)
    }

@app.put("/api/projects/{project_id}/data")
def update_project_data(
    project_id: int,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, project_id, current_user)
    try:
        data = payload.get("data", [])
        types = payload.get("types", {})

        if not data:
            raise HTTPException(status_code=400, detail="No se enviaron datos")

        data = _sanitize_json(data)
        df = pd.DataFrame(data)

        for col, col_type in types.items():
            if col not in df.columns:
                continue
            try:
                if col_type == "numeric":
                    df[col] = pd.to_numeric(df[col], errors='coerce')
                elif col_type == "binary":
                    df[col] = df[col].astype(str).str.strip()
                    if set(df[col].unique()).issubset({'SI', 'NO', 'S', 'N', 'TRUE', 'FALSE'}):
                        df[col] = df[col].map(lambda x: 1 if x.upper() in ['SI','S','TRUE','1'] else 0)
                    else:
                        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)
                elif col_type == "categorical":
                    df[col] = df[col].astype(str)
                elif col_type == "date":
                    df[col] = pd.to_datetime(df[col], errors='coerce')
            except Exception:
                pass

        csv_data = df.to_csv(index=False, encoding='utf-8')
        project.csv_data = csv_data
        project.columns = json.dumps(df.columns.tolist())
        project.row_count = len(df)
        project.updated_at = datetime.utcnow()
        db.commit()
        return {"message": "Datos actualizados correctamente", "row_count": project.row_count}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al procesar los datos: {str(e)}")

# ------------------------------------------------------------
# ENDPOINTS DE ANÁLISIS (SIN PROYECTO)
# ------------------------------------------------------------

@app.post("/api/shapiro")
async def shapiro_test(request: ShapiroRequest):
    return RBridge.shapiro_test(pd.Series(request.values))

@app.post("/api/compare")
async def compare_groups(request: CompareRequest):
    return RBridge.compare_two_groups(
        pd.Series(request.group1),
        pd.Series(request.group2),
        paired=request.paired,
        method=request.method,
        conf_level=request.conf_level
    )

@app.post("/api/correlation")
async def correlation_test(request: CorrelationRequest):
    return RBridge.correlation(
        pd.Series(request.series1),
        pd.Series(request.series2),
        method=request.method,
        conf_level=request.conf_level
    )

@app.post("/api/chi-square")
async def chi_square_test(request: ChiSquareRequest):
    df = pd.DataFrame({"var1": request.var1, "var2": request.var2})
    return RBridge.chi_square(df, "var1", "var2")

@app.post("/api/z-test")
async def z_test(request: ZTestRequest):
    return RBridge.z_test(pd.Series(request.values), request.mu)

@app.post("/api/kolmogorov-smirnov")
async def ks_test(request: KolmogorovSmirnovRequest):
    return RBridge.kolmogorov_smirnov(
        pd.Series(request.series1),
        pd.Series(request.series2)
    )

@app.post("/api/ks-one-sample")
async def ks_one_sample(request: KsOneSampleRequest):
    return RBridge.ks_one_sample(
        pd.Series(request.values),
        dist=request.dist,
        mean=request.mean,
        sd=request.sd
    )

@app.post("/api/sample-size")
async def sample_size(request: SampleSizeRequest):
    return RBridge.sample_size(request.alpha, request.power, request.effect, request.test_type)

@app.post("/api/bonferroni")
async def bonferroni(request: BonferroniRequest):
    return RBridge.bonferroni_correction(request.p_values)

@app.post("/api/binomial-test")
async def binomial_test(request: BinomialTestRequest):
    return RBridge.binomial_test(
        request.successes, request.trials,
        request.p_null, request.alternative
    )

# ------------------------------------------------------------
# ENDPOINTS DE ANÁLISIS (CON PROYECTO, PROTEGIDOS)
# ------------------------------------------------------------

@app.post("/api/linear-regression")
def linear_regression(
    request: LinearRegressionProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    return RBridge.linear_regression(df, request.dep_var, request.indep_vars)

@app.post("/api/logistic-regression")
def logistic_regression(
    request: LogisticRegressionProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    try:
        return RBridge.logistic_regression(df, request.dep_var, request.indep_vars)
    except (ValueError, TypeError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@app.post("/api/anova")
def anova_test(
    request: AnovaProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    return RBridge.anova(
        df, request.dep_var, request.group_var,
        subject_var=request.subject_var,
        repeated=request.repeated,
        method=request.method
    )

@app.post("/api/friedman")
def friedman_test(
    request: FriedmanProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    return RBridge.friedman_test(df, request.columns)

@app.post("/api/mcnemar")
def mcnemar_test(
    request: McNemarProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    return RBridge.mcnemar_test(df, request.var1, request.var2)

@app.post("/api/odds-ratio")
def odds_ratio(
    request: OddsRatioProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    return RBridge.odds_ratio(df, request.var1, request.var2)

@app.post("/api/kappa")
def kappa(
    request: KappaProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    return RBridge.kappa_cohen(df, request.var1, request.var2)

@app.post("/api/roc-curve")
def roc_curve(
    request: RocCurveProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    return RBridge.roc_curve(df, request.outcome, request.predictor)

@app.post("/api/diagnostic-accuracy")
def diagnostic_accuracy(
    request: DiagnosticAccuracyProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    return RBridge.diagnostic_accuracy(df, request.outcome, request.predictor, request.threshold)

@app.post("/api/kaplan-meier")
def kaplan_meier(
    request: KaplanMeierProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    return RBridge.kaplan_meier(df, request.time_var, request.event_var, request.group_var)

@app.post("/api/cox-regression")
def cox_regression(
    request: CoxRegressionProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    return RBridge.cox_regression(df, request.time_var, request.event_var, request.covariates)

@app.post("/api/bland-altman")
def bland_altman(
    request: BlandAltmanProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    return RBridge.bland_altman(df, request.var1, request.var2)

@app.post("/api/icc")
def icc(
    request: ICCProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    return RBridge.icc(df, request.columns)

@app.post("/api/ancova")
def ancova(
    request: AncovaProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    return RBridge.ancova(df, request.dep_var, request.group_var, request.covariates)

@app.post("/api/propensity-score")
def propensity_score(
    request: PropensityScoreProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    return RBridge.propensity_score(df, request.treatment, request.covariates)

@app.post("/api/table1")
def table1(
    request: Table1ProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    # Verificar que todas las columnas existen
    missing = [col for col in request.variables if col not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Columnas no encontradas en el dataset: {', '.join(missing)}")
    if request.group_var and request.group_var not in df.columns:
        raise HTTPException(status_code=400, detail=f"Variable de agrupación '{request.group_var}' no encontrada en el dataset")
    return RBridge.table1(df, request.variables, request.group_var, request.decimals)

@app.post("/api/levene")
def levene(
    request: LeveneProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    return RBridge.levene_test(df, request.dep_var, request.group_var)

@app.post("/api/chisq-goodness-of-fit")
def chisq_goodness_of_fit(
    request: ChisqGoodnessOfFitProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    return RBridge.chisq_goodness_of_fit(df, request.var, request.p_null)

@app.post("/api/graph")
def generate_graph(
    request: GraphProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    graph_type = request.graph_type.lower()

    if graph_type == "boxplot":
        img_bytes, script = RBridge.ggplot_boxplot(
            df, request.x_var, request.y_var, request.color_var,
            request.title, request.xlab, request.ylab,
            request.palette, request.theme,
            request.width, request.height, request.dpi
        )
    elif graph_type == "scatter":
        img_bytes, script = RBridge.ggplot_scatter(
            df, request.x_var, request.y_var, request.color_var,
            request.title, request.xlab, request.ylab,
            request.palette, request.theme,
            request.width, request.height, request.dpi
        )
    elif graph_type == "histogram":
        img_bytes, script = RBridge.ggplot_histogram(
            df, request.x_var, request.fill_var, request.bins,
            request.title, request.xlab, request.ylab,
            request.palette, request.theme,
            request.width, request.height, request.dpi
        )
    elif graph_type == "barplot":
        img_bytes, script = RBridge.ggplot_barplot(
            df, request.x_var, request.y_var, request.fill_var,
            request.title, request.xlab, request.ylab,
            request.palette, request.theme,
            request.width, request.height, request.dpi
        )
    elif graph_type == "density":
        img_bytes, script = RBridge.ggplot_density(
            df, request.x_var, request.fill_var,
            request.title, request.xlab, request.ylab,
            request.palette, request.theme,
            request.width, request.height, request.dpi
        )
    elif graph_type == "roc":
        img_bytes, script = RBridge.ggplot_roc(
            df, request.x_var, request.y_var,
            request.title, request.xlab, request.ylab,
            request.palette, request.theme,
            request.width, request.height, request.dpi
        )
    else:
        raise HTTPException(status_code=400, detail=f"Tipo de gráfico no soportado: {graph_type}")

    return {
        "image_base64": base64.b64encode(img_bytes).decode("utf-8"),
        "script_r": script
    }

# ------------------------------------------------------------
# ENDPOINT DE SUBIDA DIRECTA (UTILIDAD, SIN PROYECTO)
# ------------------------------------------------------------
@app.post("/api/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(400, "Solo se aceptan archivos CSV")
    contents = await file.read()
    df = pd.read_csv(StringIO(contents.decode('utf-8')))
    return {
        "columnas": df.columns.tolist(),
        "tipos": [str(df[c].dtype) for c in df.columns],
        "filas": len(df),
        "vista_previa": df.head(5).to_dict(orient="records")
    }

@app.post("/api/descriptive")
def descriptive_stats(request: DescriptiveRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = get_project_or_404(db, request.project_id, current_user)
    df = get_df_from_project(project)
    return RBridge.descriptive_stats(df, request.columns)