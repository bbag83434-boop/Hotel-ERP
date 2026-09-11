import io, sys
buf = io.StringIO()
try:
    from app.main import app
    buf.write("BACKEND_IMPORT_OK " + str(app.title) + "\n")
    # compile-check the two files the concurrent session was editing
    import py_compile
    for f in ["backend/app/schemas/procurement.py","backend/app/api/v1/endpoints/procurement.py"]:
        py_compile.compile(f, doraise=True)
        buf.write("COMPILE_OK " + f + "\n")
except Exception as e:
    buf.write("BACKEND_CHECK_FAIL " + repr(e) + "\n")
open("backend-verify-result.txt","w").write(buf.getvalue())
