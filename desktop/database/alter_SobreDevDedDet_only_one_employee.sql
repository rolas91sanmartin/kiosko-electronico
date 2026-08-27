USE [RRHH]
GO
/****** Object:  StoredProcedure [dbo].[SobreDevDedDet]    Script Date: 25/8/2026 2:28:38 PM ******/
SET ANSI_NULLS OFF
GO
SET QUOTED_IDENTIFIER OFF
GO
ALTER PROCEDURE [dbo].[SobreDevDedDet] 
@_cCod_nomina int,@_ConsecPlani int,@tabDeven  varchar(100),@tabdeducc  varchar(100),@tabhextra varchar(100),
@HorasNoLab VARCHAR(100),@Subsdio VARCHAR(100),@vcorreo INT,@emp INT,@Dependencia VARCHAR(max),@sobreDetalle int,
@onlyOneEmploye BIT = 0
AS


--EXEC SobreDevDedDet @_cCod_nomina =  3, @_ConsecPlani= 216, @tabDeven= 'Hist_devengados', 
--@tabdeducc='Hist_deduccion', @tabhextra='Hist_HorasExtras', @HorasNoLab='Hist_HoraNoLaborada', 
--@Subsdio='Hist_Subsidio', @vcorreo=1, @emp=0 
--comentarios--------------------------
--declare @codnomina int, @_cCod_nomina INT,@_ConsecPlani INT---@fechaini char,@fechafin char,
--set @codnomina=1
----set @fechaini='2015-04-01'--'2012-05-26'
----set @fechafin='2015-04-31'--'2013-06-01'
--SET @_cCod_nomina=1
--declare @tabdeducc AS varchar(100),@tabDeven AS varchar(100),@tabhextra varchar(1000),@HorasNoLab varchar(1000),@Subsdio varchar(1000)
--SET @tabDeven='Hist_devengados'--'Hist_devengados'    --'mov_devengados'
--set @tabdeducc='Hist_deduccion'--'Hist_deduccion'   --'mov_deducciones'
--SET @tabhextra='Hist_HorasExtras'   --'Horas_Extras'
--SET @HorasNoLab='Hist_HoraNoLaborada'
--set @Subsdio='Hist_Subsidio' 
--set @_ConsecPlani=89


--EXEC SobreDevDedDet @_cCod_nomina =  1, @_ConsecPlani= 89, @tabDeven= 'Hist_devengados', @tabdeducc='Hist_deduccion', @tabhextra='Hist_HorasExtras', 
--@HorasNoLab='Hist_HoraNoLaborada', @Subsdio='Hist_Subsidio' 

declare @SQLStmt nvarchar(max)--,@Dependencia VARCHAR(max)
--n set @Dependencia ='0'
DECLARE  @Empleados table (cod_nomina int,cod_empleado int,nom_empleado varchar(50),ape_empleado varchar(50),
	cod_cargo int,fecha_nac datetime,fecha_ing datetime,numero_inss varchar(50),cedula varchar(50),cod_sexo char(1),
	afiliado_sindicato bit,cuenta_ahorro varchar(20),activo bit,salario_cordobas numeric(18,2),salario_dolares numeric(18,2),
	dolarizado bit,foto varchar(100),CodRegimenInss int,Cod_CateSalarial int,cod_dependencia varchar(50),
	SalarioFijo bit,CodSindicato int,DevengaIncentivo bit,correo varchar(50))

DECLARE  @TmpEmpleados table (cod_nomina int,cod_empleado int,nom_empleado varchar(50),ape_empleado varchar(50),
	cod_cargo int,fecha_nac datetime,fecha_ing datetime,numero_inss varchar(50),cedula varchar(50),cod_sexo char(1),
	afiliado_sindicato bit,cuenta_ahorro varchar(20),activo bit,salario_cordobas numeric(18,2),salario_dolares numeric(18,2),
	dolarizado bit,foto varchar(100),CodRegimenInss int,Cod_CateSalarial int,cod_dependencia varchar(50),
	SalarioFijo bit,CodSindicato int,DevengaIncentivo bit,correo varchar(50))

--CREATE TABLE #TmpEmpleados (
--    cod_nomina INT,
--    cod_empleado INT,
--    nom_empleado VARCHAR(50),
--    ape_empleado VARCHAR(50),
--    cod_cargo INT,
--    fecha_nac DATETIME,
--    fecha_ing DATETIME,
--    numero_inss VARCHAR(50),
--    cedula VARCHAR(50),
--    cod_sexo CHAR(1),
--    afiliado_sindicato BIT,
--    cuenta_ahorro VARCHAR(20),
--    activo BIT,
--    salario_cordobas NUMERIC(18,2),
--    salario_dolares NUMERIC(18,2),
--    dolarizado BIT,
--    foto VARCHAR(100),
--    CodRegimenInss INT,
--    Cod_CateSalarial INT,
--    cod_dependencia VARCHAR(50),
--    SalarioFijo BIT,
--    CodSindicato INT,
--    DevengaIncentivo BIT,
--    correo VARCHAR(50)
--)

DECLARE @catDev TABLE (cod_devengado INT,des_devengado CHAR(50))
DECLARE @catDed TABLE (cod_deduccion INT,des_deduccion CHAR(50),ImprimirEnColilla bit)

if @sobreDetalle=1 BEGIN
   INSERT INTO @catDev(cod_devengado,des_devengado)
   SELECT c.cod_devengado,c.des_devengado FROM cat_devengados c
   
   	INSERT INTO @catDed(cod_deduccion,des_deduccion,ImprimirEnColilla)
	SELECT cod_deduccion,des_deduccion,ImprimirEnColilla FROM [dbo].[Cat_deducciones] c
	 
END ELSE BEGIN
   INSERT INTO @catDev(cod_devengado,des_devengado)
   SELECT c.cod_devengado,c.des_devengado FROM cat_devengados c WHERE cod_devengado 
   	                                                                  nOT IN (SELECT cod_Devengado 
                                                                              FROM ReporteSobreDev WHERE COD_NOMINA=@_cCod_nomina) 
   INSERT INTO @catDev(cod_devengado,des_devengado)
   SELECT DISTINCT  c.cod_devengado,r.ROTULO FROM cat_devengados c INNER JOIN ReporteSobreDev r 
                                                  ON r.COD_DEVENGADO = c.cod_devengado
  WHERE r.COD_NOMINA=@_cCod_nomina
   ---------------deduccion-------------------------------------------
   INSERT INTO @catDed(cod_deduccion,des_deduccion,ImprimirEnColilla)
   SELECT cod_deduccion,des_deduccion,ImprimirEnColilla FROM [dbo].[Cat_deducciones] c WHERE cod_deduccion 
   	                                                                  nOT IN (SELECT cod_deduccion 
   	                                                                          FROM ReporteSobreDeduc WHERE COD_NOMINA=@_cCod_nomina)
   INSERT INTO @catDed(cod_deduccion,des_deduccion,ImprimirEnColilla)
   SELECT DISTINCT  c.cod_deduccion,r.ROTULO,ImprimirEnColilla FROM Cat_deducciones c INNER JOIN [dbo].[ReporteSobreDeduc] r 
                                                  ON r.cod_deduccion = c.cod_deduccion
   WHERE r.COD_NOMINA=@_cCod_nomina	                                                	                                                                          
end

-- Cuando @onlyOneEmploye=1 obtiene exclusivamente el empleado indicado en @emp,
-- sin depender de que tenga un correo registrado o con formato válido.
IF @onlyOneEmploye=1 BEGIN
	INSERT INTO @Empleados
	SELECT cod_nomina,cod_empleado,nom_empleado,ape_empleado,
		   cod_cargo,fecha_nac,fecha_ing,numero_inss,cedula,cod_sexo,
		   afiliado_sindicato,cuenta_ahorro,activo,salario_cordobas,salario_dolares,
		   dolarizado,foto,CodRegimenInss,Cod_CateSalarial,cod_dependencia,
		   SalarioFijo,CodSindicato,DevengaIncentivo,rtrim(ltrim(correo))
	FROM Empleados e
	WHERE e.cod_nomina=@_cCod_nomina
	  AND e.cod_empleado=@emp
END ELSE IF @vcorreo=1 BEGIN 
	IF @emp<>0 BEGIN ---x empleado
		--INSERT INTO #TmpEmpleados
		INSERT INTO @Empleados
		SELECT cod_nomina,cod_empleado,nom_empleado,ape_empleado,
			   cod_cargo,fecha_nac,fecha_ing,numero_inss,cedula,cod_sexo,
			   afiliado_sindicato,cuenta_ahorro,activo,salario_cordobas,salario_dolares,
			   dolarizado,foto,CodRegimenInss,Cod_CateSalarial,cod_dependencia,
			   SalarioFijo,CodSindicato,DevengaIncentivo,rtrim(ltrim(correo)) 
		FROM Empleados e 
		WHERE  e.cod_nomina=@_cCod_nomina AND e.cod_empleado=@emp and
	           e.correo IS NOT null and correo LIKE '%_@__%.__%' 
	end ELSE BEGIN  ---empleados SIN correos 
	    --INSERT INTO #TmpEmpleados
		INSERT INTO @Empleados
		SELECT cod_nomina,cod_empleado,nom_empleado,ape_empleado,
			   cod_cargo,fecha_nac,fecha_ing,numero_inss,cedula,cod_sexo,
			   afiliado_sindicato,cuenta_ahorro,activo,salario_cordobas,salario_dolares,
			   dolarizado,foto,CodRegimenInss,Cod_CateSalarial,cod_dependencia,
			   SalarioFijo,CodSindicato,DevengaIncentivo,rtrim(ltrim(correo))
	    FROM Empleados e 
		WHERE  (e.correo IS NULL or correo not LIKE  '%_@__%.__%' or correo='') AND e.cod_nomina=@_cCod_nomina ----empleados sin correos
		--WHERE  e.cod_nomina=@_cCod_nomina AND e.correo IS noT null and correo LIKE '%_@__%.__%'----empleados solo con correos 
		---e.activo=1 AND 
	end	  
END ELSE BEGIN ----todos los empleados 
	--INSERT INTO #TmpEmpleados
	INSERT INTO @Empleados
	SELECT cod_nomina,cod_empleado,nom_empleado,ape_empleado,
		   cod_cargo,fecha_nac,fecha_ing,numero_inss,cedula,cod_sexo,
		   afiliado_sindicato,cuenta_ahorro,activo,salario_cordobas,salario_dolares,
		   dolarizado,foto,CodRegimenInss,Cod_CateSalarial,cod_dependencia,
		   SalarioFijo,CodSindicato,DevengaIncentivo,rtrim(ltrim(correo))
    FROM Empleados e 
	WHERE  e.cod_nomina=@_cCod_nomina --AND	e.activo=1
	--update empleados set correo='xtalavera@sanmartin.com.ni'WHERE cod_empleado=262
end	
--if @Dependencia='0' begin 
--    INSERT INTO @Empleados
--	select * from #TmpEmpleados
--end else begin 
--     SET @SQLStmt='
--            select * from #TmpEmpleados e where (e.cod_dependencia in ' + ' ' + '(' + @Dependencia + ' ))'
--			INSERT INTO @Empleados
--            execute (@SQLStmt)
--end 
--drop table #TmpEmpleados


--select * from @Empleados where cod_empleado=7541

DECLARE @SQLStmtSubsidio varchar(1000),@SQLStmtHoraNoLa varchar(1000),@SQLStmtDev varchar(1000),@SQLStmtDeduc varchar(1000),
@SQLStmExtra varchar(1000),@fechaini  datetime,@fechafin  datetime,@SQLSSalVaca varchar(1000),@tabSalVava varchar(1000),
@SQLStmProd varchar(1000)

IF @tabDeven = 'mov_devengados' BEGIN
	set @tabSalVava='Mov_SalarioVaca'
	SET @SQLStmProd='Mov_Produccion' 
END ELSE BEGIN 
	set @tabSalVava='HistSalarioVaca'
	SET @SQLStmProd='HistMovProduccion'
end 

DECLARE @Dias_Laborados NUMERIC(18,2) 
SET @Dias_Laborados = (SELECT TOP 1 p.Dias_Calc_Ordi FROM Periodicidad p)

SET @fechaini =(SELECT fecha_inic FROM Planillas p WHERE p.Consecutivo_pla=@_ConsecPlani AND p.cod_nomina=@_cCod_nomina)
set @fechafin=(SELECT fecha_fina FROM Planillas p WHERE p.Consecutivo_pla=@_ConsecPlani AND p.cod_nomina=@_cCod_nomina)

----20/06/2018--
DECLARE @SQLSSalVacaDet varchar(1000)
DECLARE @salaVacaDet TABLE(diasdes NUMERIC(18,2),cod_empleado INT,Fecha_DiaDesc datetime)
set @SQLSSalVacaDet='SET DATEFORMAT DMY '+ 'SELECT DIASaPAGAR AS diad,Cod_empleado,Fecha_DiaDesc FROM ' + @tabSalVava + ' where cod_nomina=' + convert(nvarchar,@_cCod_nomina,103) + ' AND fecha_inic= ''' + CONVERT(NVARCHAR,@fechaini,103)  + ''' and fecha_fina= ''' + CONVERT(NVARCHAR, @fechafin,103) + '''  ' --+ ' AND fecha_inic= ''' + CONVERT(NVARCHAR,@fechaini,103) + ''' and fecha_fina= ''' + CONVERT(NVARCHAR, @fechafin,103) + '''' + ' GROUP BY Cod_empleado '
insert INTO @salaVacaDet
execute (@SQLSSalVacaDet)
set @SQLSSalVacaDet=''
---produccion ---[]
DECLARE @ProducDet TABLE(canDiasProd INT,cod_empleado INT)
set @SQLSSalVacaDet='SET DATEFORMAT DMY '+ 'SELECT count(*),Cod_empleado FROM ' + @SQLStmProd + ' where PRODUC_EMPL<>0 AND cod_nomina=' + convert(nvarchar,@_cCod_nomina,103) + ' AND fecha_produccion between ''' + CONVERT(NVARCHAR,@fechaini,103)  + ''' and ''' + CONVERT(NVARCHAR, @fechafin,103) + ''' group by cod_empleado ' --+ ' AND fecha_inic= ''' + CONVERT(NVARCHAR,@fechaini,103) + ''' and fecha_fina= ''' + CONVERT(NVARCHAR, @fechafin,103) + '''' + ' GROUP BY Cod_empleado '
insert INTO @ProducDet
execute (@SQLSSalVacaDet)
set @SQLSSalVacaDet=''
--select * from @salaVacaDet
--select * from @ProducDet
------
DECLARE @salaVaca TABLE(diasdes NUMERIC(18,2),cod_empleado int)
--tipo=''VAC''and
DECLARE @salaVacaUnido TABLE(diasdes NUMERIC(18,2),cod_empleado int)
--set @SQLSSalVaca='SET DATEFORMAT DMY '+ 'SELECT COUNT(*) AS diad,Cod_empleado FROM ' + @tabSalVava + ' where   cod_nomina=' + convert(nvarchar,@_cCod_nomina,103) + ' AND fecha_inic= ''' + CONVERT(NVARCHAR,@fechaini,103)  + ''' and fecha_fina= ''' + CONVERT(NVARCHAR, @fechafin,103) + ''' GROUP BY Cod_empleado ' --+ ' AND fecha_inic= ''' + CONVERT(NVARCHAR,@fechaini,103) + ''' and fecha_fina= ''' + CONVERT(NVARCHAR, @fechafin,103) + '''' + ' GROUP BY Cod_empleado '
set @SQLSSalVaca='SET DATEFORMAT DMY '+ 'SELECT sum(DiasApagar) AS diad,Cod_empleado FROM ' + @tabSalVava + ' where   cod_nomina=' + convert(nvarchar,@_cCod_nomina,103) + ' AND fecha_inic= ''' + CONVERT(NVARCHAR,@fechaini,103)  + ''' and fecha_fina= ''' + CONVERT(NVARCHAR, @fechafin,103) + ''' GROUP BY Cod_empleado ' --+ ' AND fecha_inic= ''' + CONVERT(NVARCHAR,@fechaini,103) + ''' and fecha_fina= ''' + CONVERT(NVARCHAR, @fechafin,103) + '''' + ' GROUP BY Cod_empleado '
insert INTO @salaVacaUnido
execute (@SQLSSalVaca)
--select * from @salaVacaUnido
--INSERT INTO @salaVacaUnido
--SELECT distinct COUNT(*),e.cod_empleado
--  FROM DiasVacacionXDepen dvx INNER JOIN empleados e ON e.Cod_dependencia = dvx.Cod_dependencia  
--WHERE dvx.DiaVacacion BETWEEN @fechaini AND @fechafin AND e.activo=1 AND e.cod_nomina= @_cCod_nomina 
--      AND NOT EXISTS (SELECT * FROM @salaVacaDet s WHERE s.cod_empleado=e.cod_empleado AND s.Fecha_DiaDesc=dvx.DiaVacacion)
--GROUP BY e.cod_empleado
	
INSERT INTO @salaVaca
SELECT SUM(diasdes),cod_empleado FROM @salaVacaUnido group by cod_empleado ORDER BY cod_empleado 


--PRINT @SQLSSalVaca
declare @dev TABLE(Cod_devengado INT,Cod_empleado INT,fecha_inic DATETIME,fecha_fina DATETIME,cod_nomina INT,cod_usuario VARCHAR(50),valor_devengado NUMERIC(18,2),consecutivo_pla INT,generadoxsist BIT,cod_proceso NUMERIC(18,0),cod_dependencia VARCHAR(15),Basico NUMERIC(18,2),BasicSinRest NUMERIC(18,2))
SET @SQLStmtDev ='SET DATEFORMAT DMY '+ 'SELECT * FROM ' + @tabDeven + ' where cod_nomina=' + convert(nvarchar,@_cCod_nomina,103) + ' AND fecha_inic= ''' + CONVERT(NVARCHAR,@fechaini,103) + ''' and fecha_fina= ''' + CONVERT(NVARCHAR, @fechafin,103) + '''' --into ##dev
--PRINT(@SQLStmtDev)
insert INTO @dev
execute (@SQLStmtDev)

DECLARE @ded TABLE (Cod_deduccion INT,Cod_empleado INT,fecha_inic DATETIME,fecha_fina DATETIME,cod_nomina INT,NoDocDeuda INT,TipoDocDeuda int,fecha_deuda DATETIME,cod_usuario varchar(50),MontoTotDeuda NUMERIC(18,2),valor_deduccion NUMERIC(18,2),Saldo_deuda NUMERIC(18,2),AbonoReal NUMERIC(18,2),MontoTotDeudaDol NUMERIC(18,2),valor_deduccionDol NUMERIC(18,2),Saldo_deudaDol NUMERIC(18,2),AbonoRealDol NUMERIC(18,2),consecutivo_pla INT,generadoxsist BIT,cod_proceso NUMERIC(18),deduc_nuevo BIT,PactCordDolar BIT,dolarizar CHAR(1),RECURRENTE BIT,RespSalCor NUMERIC(18,2),RespSalDol NUMERIC(18,2),Referencia VARCHAR(500),CuotaDolores BIT,CuotaFija BIT,Porcentaje NUMERIC(18,4),ModAbono int)
set @SQLStmtDeduc='SET DATEFORMAT DMY ' + 'SELECT *  FROM ' + @tabdeducc + ' where cod_nomina=' + convert(nvarchar,@_cCod_nomina,103) + ' AND fecha_inic= ''' + CONVERT(NVARCHAR,@fechaini,103) + ''' and fecha_fina= ''' + CONVERT(NVARCHAR, @fechafin,103) + ''''--into  ##ded
INSERT INTO @ded
execute (@SQLStmtDeduc)

DECLARE @extra TABLE(Cod_empleado INT,fecha_hextras DATETIME,cant_hextras NUMERIC(18,2),consecutivo_pla INT,cod_nomina INT,cod_usuario VARCHAR(50),Valor NUMERIC(18,2))
set @SQLStmExtra='SET DATEFORMAT DMY ' + 'SELECT Cod_empleado,fecha_hextras,cant_hextras,consecutivo_pla,cod_nomina,cod_usuario,Valor  FROM ' + @tabhextra + ' where cod_nomina=' + convert(nvarchar,@_cCod_nomina,103) + 'and Consecutivo_pla=' + convert(nvarchar,@_ConsecPlani,103)--' and fecha_hextras between ''' + CONVERT(NVARCHAR,@fechaini,103) + ''' and ''' + CONVERT(NVARCHAR, @fechafin,103) + '''' 
--set @SQLStmExtra='SELECT Cod_empleado,fecha_hextras,cant_hextras,consecutivo_pla,cod_nomina,cod_usuario,Valor  FROM ' + @tabhextra + ' where cod_nomina=' + convert(nvarchar,@_cCod_nomina,103) + ' and fecha_hextras BETWEEN ' + CONVERT(NVARCHAR,@fechaini,103) + ' and ' + CONVERT(NVARCHAR, @fechafin,103) 
--print (@SQLStmExtra)
insert into @extra
execute (@SQLStmExtra)
--,cod_usuario VARCHAR(50)
--DECLARE @HoranoLab TABLE (Cod_empleado INT,cod_usuario VARCHAR(50),cod_nomina int,consecutivo_pla int, FechaIngReg DATETIME,HorasNoLab NUMERIC(18,2),Justificado BIT,ConGoceSalario BIT,ValorHoraNoLa CHAR(10),Fec_Ini_Vacacion DATETIME,Fec_Fin_Vacacion DATETIME,Cod_TiempoNoJust INT,Cod_Ciudad INT,Notas VARCHAR(50))
--set @SQLStmtHoraNoLa='SET DATEFORMAT DMY ' + 'SELECT Cod_empleado,cod_usuario,cod_nomina,consecutivo_pla,FechaIngReg,HorasNoLab,Justificado,ConGoceSalario,ValorHoraNoLa,Fec_Ini_Vacacion,Fec_Fin_Vacacion,Cod_TiempoNoJust,Cod_Ciudad,Notas  FROM ' + @HorasNoLab + ' where cod_nomina=' + convert(nvarchar,@_cCod_nomina,103) + 'and Consecutivo_pla=' + convert(nvarchar,@_ConsecPlani,103)
DECLARE @HoranoLab TABLE (Cod_empleado INT,cod_nomina int,consecutivo_pla int, HorasNoLab NUMERIC(18,2),Justificado BIT,ConGoceSalario BIT,ValorHoraNoLa NUMERIC(18,2))
set @SQLStmtHoraNoLa='SET DATEFORMAT DMY ' + 'SELECT Cod_empleado,cod_nomina,consecutivo_pla,sum(HorasNoLab) as HorasNoLab,Justificado,ConGoceSalario,sum(ValorHoraNoLa) as ValorHoraNoLa  FROM ' + @HorasNoLab + ' where cod_nomina=' + convert(nvarchar,@_cCod_nomina,103) + 'and ConGoceSalario=0 and Consecutivo_pla=' + convert(nvarchar,@_ConsecPlani,103)+ 'group by Cod_empleado,cod_nomina,consecutivo_pla,Justificado,ConGoceSalario'
INSERT INTO @HoranoLab
execute (@SQLStmtHoraNoLa)
--SELECT * FROM @HoranoLab WHERE Cod_empleado=6462

--update @HoranoLab SET HorasNoLab=CASE WHEN HorasNoLab<>8 THEN 8 ELSE HorasNoLab END 
--                FROM @HoranoLab h JOIN @Empleados e ON e.Cod_empleado = h.Cod_empleado    
--WHERE e.Cod_CateSalarial<>0


DECLARE @tmpsub TABLE (Cod_empleado INT,FechaInicioSub datetime,cod_nomina int,consecutivo_pla int,NoOrden VARCHAR(50),NoDias NUMERIC (8),AtendidoPor numeric(18),Diagnostico VARCHAR(100),FecHoraAccidente DATETIME,CasoTerminado bit,Fecha_Emision datetime,Tipo_subsidio NUMERIC(18),fec_probable_parto DATETIME,fecha_de_parto DATETIME,Grupo CHAR(3),Clave CHAR(1),FechaDiagnost datetime,cod_usuario CHAR(50),DiaSubtransc numeric(18,2),nuevo BIT,Cod_Ubicacion INT,Cod_Miembro int)
set @SQLStmtSubsidio='SET DATEFORMAT DMY ' + 'SELECT *  FROM ' + @Subsdio + ' where cod_nomina=' + convert(nvarchar,@_cCod_nomina,103) + 'and Consecutivo_pla=' + convert(nvarchar,@_ConsecPlani,103)
INSERT INTO @tmpsub
execute (@SQLStmtSubsidio)

DECLARE @sub TABLE (Cod_empleado INT,DiaSubtransc numeric(8))
INSERT INTO @sub SELECT Cod_empleado,SUM(DiaSubtransc) as DiaSubtransc FROM @tmpsub GROUP by cod_empleado 
	--SELECT * FROM @tmpsub

/*------------------------------DEDUCCION***datepart(dw, fecha_diadesc) NOT in (1) A***************************************/
/*datos de empleado con sus cargos */
DECLARE @datos TABLE(COD_EMPLEADO INT,nom_empleado VARCHAR(50),ape_empleado VARCHAR(50),cedula VARCHAR(50),numero_inss VARCHAR(50),des_cargo VARCHAR(50),cod_dependencia VARCHAR(10),des_dependencia VARCHAR(50))
;
--as ValorDed agrupando segun lo que escojieron en configuracion de reporte y tomado los movimientos..into #DedValEmp 
DECLARE @tresdatos TABLE(fecha_ing datetime,Valor NUMERIC(18,2),cod_empleado int,ROTULO VARCHAR(50),saldo NUMERIC(18,2),cod_deduccion int,nom_empleado VARCHAR(50),ape_empleado VARCHAR(50),cedula VARCHAR(50),numero_inss VARCHAR(50),des_cargo VARCHAR(50),cod_dependencia VARCHAR(10),des_dependencia VARCHAR(50)) 
INSERT INTO @tresdatos
select fecha_ing,sum(isnull(AbonoReal,0)) as Valor,ded.cod_empleado,des_deduccion AS ROTULO,sum(isnull(saldo_deuda,0)) as saldo,ded.Cod_deduccion,
nom_empleado,ape_empleado,cedula,numero_inss,des_cargo,e.cod_dependencia,des_dependencia 
from @ded ded inner join @catDed Catded on ded.Cod_deduccion=Catded.Cod_deduccion 
INNER JOIN @empleados e on ded.cod_empleado=e.cod_empleado INNER JOIN cargos ON e.cod_cargo=cargos.cod_cargo 
inner JOIN Dependencia d ON d.cod_dependencia=e.cod_dependencia --inner join   [dbo].[borrar] b on ltrim(b.depend)=ltrim(e.cod_dependencia) 
where ded.cod_nomina=@_cCod_nomina  and fecha_inic=@fechaini and fecha_fina=@fechafin ---AND e.ACTIVO=1
group by fecha_ing,ded.cod_empleado,des_deduccion,ded.Cod_deduccion,nom_empleado,ape_empleado,cedula,numero_inss,des_cargo,e.cod_dependencia,des_dependencia 
order by ded.cod_empleado
--ded.Cod_deduccion,
--SELECT * FROM @tresdatos where cod_empleado=5007
DELETE FROM @tresdatos WHERE Valor=0 AND saldo =0 --#DedValEmp



---borrar despues 28/08/2019
DELETE FROM @tresdatos WHERE Valor=0 AND cod_empleado IN (SELECT cod_empleado FROM Suspencion s WHERE s.Suspencion=1)
-------las deudas que no sean con la empresa no se reflaja saldo 10/10/2018
--UPDATE @tresdatos SET saldo =0 FROM Cat_deducciones cd INNER JOIN @tresdatos d ON cd.cod_deduccion=d.cod_deduccion
--WHERE cd.DEUDA_COM_EMP=0 

UPDATE @tresdatos SET saldo =0 FROM @catDed cd INNER JOIN @tresdatos d ON cd.cod_deduccion=d.cod_deduccion
WHERE cd.ImprimirEnColilla=0 


DECLARE @SobDed TABLE(fecha_ing datetime,cod_empleado int,Valor NUMERIC(18,2),fila int,RotDeduc VARCHAR(50),tipo int,saldo NUMERIC(18,2),NRO INT,nom_empleado VARCHAR(50),ape_empleado VARCHAR(50),des_cargo VARCHAR(50),cedula VARCHAR(50),numero_inss VARCHAR(50),deve_Deduc int,cod_dependencia VARCHAR(50),des_dependencia VARCHAR(50))  --into #SobDed   
INSERT INTO @SobDed
select fecha_ing,Val.cod_empleado,Valor,0 AS Fila,Rotulo as RotDeduc,tipo=0,saldo,ROW_NUMBER() OVER(PARTITION BY val.cod_empleado ORDER BY nom_empleado ASC) AS NRO,
nom_empleado,ape_empleado,des_cargo,cedula,numero_inss,deve_Deduc=0,cod_dependencia,des_dependencia
from @tresdatos val ---inner join @dosdatos dat on Val.cod_empleado=Dat.cod_empleado
--SELECT * FROM @SobDed where cod_empleado=153

---------------------------------------DEVENGADO-------------------------------------------------------
--DECLARE @ValDevEmp TABLE(Valor NUMERIC(18,2),fila int,cod_empleado int,ROTULO VARCHAR(50))
--DECLARE @devTablTemp table(cod_empleado int,valor NUMERIC(18,2),Fila int,RotDeveng VARCHAR(50),tipo int,Valoded NUMERIC(18,2),RotDeduc VARCHAR(50),saldo NUMERIC(18,2),nom_empleado VARCHAR(50),ape_empleado VARCHAR(50),des_cargo VARCHAR(50),cedula VARCHAR(50),numero_inss VARCHAR(50),deve_Deduc int,cod_dependencia VARCHAR(50),des_dependencia VARCHAR(50),NRO int)
--declare @devtab TABLE (cod_empleado int,valor NUMERIC(18,2),Fila int,RotDeveng VARCHAR(50),tipo int,Valoded int,RotDeduc VARCHAR(60),saldo NUMERIC(18,2))
declare @devtab TABLE (cod_empleado int,valor NUMERIC(18,2),Fila int,RotDeveng VARCHAR(50),tipo int,Valoded NUMERIC(18,2),RotDeduc VARCHAR(60),saldo NUMERIC(18,2),nom_empleado VARCHAR(50),ape_empleado VARCHAR(50),des_cargo VARCHAR(50),cedula VARCHAR(50),numero_inss VARCHAR(50),deve_Deduc int,cod_dependencia VARCHAR(50),des_dependencia VARCHAR(50),NRO INT,cantExtra NUMERIC(18,2),DiasTrab NUMERIC(18,2))
--declare @dosdevtab TABLE (cod_empleado int,valor NUMERIC(18,2),Fila int,RotDeveng VARCHAR(50),tipo int,Valoded int,RotDeduc VARCHAR(60),saldo NUMERIC(18,2),nom_empleado VARCHAR(50),ape_empleado VARCHAR(50),des_cargo VARCHAR(50),cedula VARCHAR(50),numero_inss VARCHAR(50),deve_Deduc int,cod_dependencia VARCHAR(50),des_dependencia VARCHAR(50),NRO int)

--/*datos de empleado con sus cargos */
;
with ValDevEmp(fecha_ing,Valor,cod_empleado,RotDeveng,nom_empleado,ape_empleado,cedula,numero_inss,des_cargo,deve_Deduc,cod_dependencia,des_dependencia) AS
 (
 ---agrupando segun lo que escojieron en configuracion de reporte y tomado los movimientos into #ValDevEmpfila,
select fecha_ing,sum (isnull(valor_devengado,0)) as Valor,dev.cod_empleado,des_devengado as RotDeveng,nom_empleado,ape_empleado,cedula,numero_inss,des_cargo,deve_Deduc=1,emple.cod_dependencia,des_dependencia 
from @dev dev inner join @catDev devr on dev.cod_devengado=devr.cod_devengado inner join @empleados emple on emple.cod_empleado=dev.cod_empleado INNER JOIN cargos c ON c.cod_cargo=emple.cod_cargo
INNER JOIN Dependencia d ON d.cod_dependencia=emple.cod_dependencia --inner join [dbo].[borrar] b on ltrim(b.depend)=ltrim(emple.cod_dependencia)
where dev.cod_nomina=@_cCod_nomina AND  fecha_inic=@fechaini and fecha_fina=@fechafin --AND activo=1
group by fecha_ing,dev.cod_empleado,des_devengado,nom_empleado,ape_empleado,cedula,numero_inss,des_cargo,emple.cod_dependencia,des_dependencia
--group by cod_empleado,des_devengado --order by cod_empleado
 )
 ,
 DosValDevEmp(fecha_ing,Valor,cod_empleado,RotDeveng,nom_empleado,ape_empleado,cedula,numero_inss,des_cargo,deve_Deduc,cod_dependencia,des_dependencia) AS  --fila,
-- insert into @ValDevEmp
 (
 SELECT * FROM ValDevEmp  WHERE Valor<>0
--elimina los conceptos en 0 tanto devengados como deducciones y son sustituidos  por el concepto siguiente que no esta en 0(ROW_NUMBER())
--DELETE FROM ValDevEmp  WHERE Valor=0
)
,
SobDeve(fecha_ing,cod_empleado,valor,Fila,RotDeveng,tipo,NRO,nom_empleado,ape_empleado,des_cargo,cedula,numero_inss,deve_Deduc,cod_dependencia,des_dependencia)AS 
(
--into #SobDeve
select fecha_ing,cod_empleado,valor,0 as fila, RotDeveng,tipo=1, ROW_NUMBER() OVER(PARTITION BY cod_empleado ORDER BY nom_empleado ASC) AS NRO,  
nom_empleado,ape_empleado,des_cargo,cedula,numero_inss,deve_Deduc,cod_dependencia,des_dependencia
from DosValDevEmp
)
-----into #dev--------------------------------------------------------------------------------------------------
--declare @devtab TABLE (cod_empleado int,valor NUMERIC(18,2),Fila int,RotDeveng VARCHAR(50),tipo int,Valoded int,RotDeduc VARCHAR(60),saldo NUMERIC(18,2))
--declare @devtab TABLE (cod_empleado int,valor NUMERIC(18,2),Fila int,RotDeveng VARCHAR(50),tipo int,Valoded int,RotDeduc VARCHAR(60),saldo NUMERIC(18,2),nom_empleado VARCHAR(50),ape_empleado VARCHAR(50),des_cargo VARCHAR(50),cedula VARCHAR(50),numero_inss VARCHAR(50),deve_Deduc int,cod_dependencia VARCHAR(50),des_dependencia VARCHAR(50),NRO int)



INSERT INTO @devtab
select cod_empleado,valor,fila,RotDeveng,tipo,
(select isnull(valor,0)  from @SobDed ded where dev.NRO=ded.NRO and dev.cod_empleado=ded.cod_empleado) as Valoded,
(select RotDeduc  from @SobDed ded where dev.NRO=ded.NRO and dev.cod_empleado=ded.cod_empleado) as RotDeduc,
(select saldo  from @SobDed ded where dev.NRO=ded.NRO and dev.cod_empleado=ded.cod_empleado) as saldo,
nom_empleado,ape_empleado,des_cargo,cedula,numero_inss,deve_Deduc,cod_dependencia,des_dependencia,NRO,0, 
case when fecha_ing BETWEEN @fechaini AND @fechafin THEN (convert(int,@fechafin-fecha_ing))+1 ELSE  @Dias_Laborados END 
from SobDeve dev --order by cod_empleado, fila 


INSERT INTO @devtab
select 
	soded.cod_empleado
	, (select isnull(valor,0)  from @devtab devtab where devtab.NRO=soded.NRO and devtab.cod_empleado=soded.cod_empleado) as Valodevg
	, soded.fila,(select RotDeveng  from @devtab devtab where devtab.NRO=soded.NRO and devtab.cod_empleado=soded.cod_empleado) as RotDeveng
	, soded.tipo
	, soded.valor
	, soded.RotDeduc
	, saldo
	, nom_empleado,ape_empleado,des_cargo,cedula,numero_inss,
deve_Deduc,cod_dependencia,des_dependencia,NRO,0, 
case when fecha_ing BETWEEN @fechaini AND @fechafin THEN convert(int,@fechafin-fecha_ing)+1 ELSE  @Dias_Laborados END
from @SobDed soded 
where  not exists  (select cod_empleado, fila  from @devtab devtab where soded.cod_empleado=devtab.cod_empleado and soded.NRO=devtab.NRO ) 


update @devtab SET DiasTrab=CASE WHEN DiasTrab=7 THEN 6 ELSE DiasTrab END 
FROM  @devtab j join @empleados e ON e.cod_empleado = j.cod_empleado WHERE fecha_ing BETWEEN @fechaini AND @fechafin 



---horas extras @extra
DECLARE @sumaExtra TABLE (Cod_empleado int, cant_hextras NUMERIC (18,2)) 
INSERT INTO @sumaExtra
select cod_empleado,sum(cant_hextras) as cant_hextras  from @extra GROUP BY Cod_empleado
	  
UPDATE @devtab SET cantExtra= p.cant_hextras 
FROM @sumaExtra p INNER JOIN @devtab de ON de.Cod_empleado = p.Cod_empleado 

UPDATE @devtab SET DiasTrab= case when diasdes=7 then 0 else DiasTrab-diasdes END  
from @devtab t join @salaVaca p on t.COD_EMPLEADO=p.cod_empleado 


--UPDATE @devtab SET DiasTrab= case when diasdes=7 then 0 else DiasTrab-diasdes END  
--from @devtab t join @salaVaca p on t.COD_EMPLEADO=p.cod_empleado 

--UPDATE @devtab SET DiasTrab= case when DiasTrab<canDiasProd then canDiasProd else DiasTrab END  
--from @devtab t join @ProducDet p on t.COD_EMPLEADO=p.cod_empleado 

--select * from @devtab WHERE cod_empleado=108

--DECLARE @Dias_Laborados INT 
--SET @Dias_Laborados = (SELECT TOP 1 p.Dias_Calc_Ordi FROM Periodicidad p)
--23/05/2018-- CONVERT(NUMERIC(18,2),(ISNULL(mhnl.HorasNoLab,0) / 8)) AS Dias_No_Laborados
 ----20/06/2018 CONVERT(NUMERIC(18,2),(case when ISNULL(mhnl.HorasNoLab,0)>8 THEN 8 ELSE ISNULL(mhnl.HorasNoLab,0) end / 8)) AS Dias_No_Laborados
DECLARE @hora  table (cod_empleado INT,HorasNoLab NUMERIC(18,2),consecutivo_pla int)
insert into @hora
SELECT cod_empleado,sum(HorasNoLab),consecutivo_pla FROM @HoranoLab GROUP BY Cod_empleado,consecutivo_pla



DECLARE @sobreifin TABLE (cod_Empleado INT,valor NUMERIC(18,2),fila INT,RotDeveng VARCHAR(100),tipo INT,Valoded NUMERIC(18,2),
                         RotDeduc VARCHAR(100),saldo NUMERIC(18,2),nom_empleado VARCHAR(100),ape_empleado VARCHAR(100),
                         des_cargo varchar(100),cedula VARCHAR(50),numero_inss varchar(50),deve_Deduc INT,
                         cod_Dependencia VARCHAR(50),des_dependencia VARCHAR(100),NRO INT,cantExtra NUMERIC(18,2),
                         DiasTrab INT,Dias_laborados NUMERIC(18,2),Dias_no_laborados INT,HorasNoLab numeric(18,2),DiaSubtransc INT,
                         DiasApagar INT,fechaini DATETIME,fechafin DATETIME,diasdes NUMERIC(18,2))
--@HoranoLab
INSERT INTO @sobreifin   
SELECT distinct
	det.*
	, DiasTrab AS Dias_Laborados
	, CONVERT(NUMERIC(18,2),(case when ISNULL(mhnl.HorasNoLab,0)>8 THEN ISNULL(mhnl.HorasNoLab,0) ELSE 
		                             CASE WHEN mhnl.HorasNoLab<8 THEN 8 ELSE ISNULL(mhnl.HorasNoLab,0) end end / 8)) AS Dias_No_Laborados
	, ISNULL(mhnl.HorasNoLab,0) AS HorasNoLab
	, ISNULL(s.DiaSubtransc,0) AS DiaSubtransc
	, DiasAPagar = CASE WHEN DiasAPagar < 0 OR DiasAPagar IS NULL THEN DiasAPagar ELSE 0 END
	, @fechaini as fechaini
	, @fechafin AS fechafin
	, diasdes
FROM @devtab det 
LEFT OUTER JOIN @Hora mhnl ON mhnl.cod_empleado = det.cod_empleado AND mhnl.consecutivo_pla = @_ConsecPlani
LEFT OUTER JOIN @sub s ON s.cod_empleado = det.cod_empleado 
LEFT JOIN dbo.MovPVacSem ON det.cod_empleado = MovPVacSem.cod_empleado 
LEFT JOIN @salaVaca sal ON det.cod_empleado = sal.cod_empleado	
--WHERE det.cod_empleado=149	
	--INNER JOIN empleados ON det.cod_empleado=empleados.cod_empleado WHERE activo=1
ORDER BY cod_dependencia--,cod_empleado,fila
 
UPDATE  @sobreifin  SET DiaSubtransc= case when DiaSubtransc > @Dias_Laborados THEN @Dias_Laborados ELSE DiaSubtransc END  
--SELECT * FROM @sobreifin WHERE cod_empleado=6462

--03/10/2024 UPDATE @sobreifin SET Dias_Laborados=ROUND((Dias_Laborados-(Dias_No_Laborados+DiaSubtransc)),2)
UPDATE @sobreifin SET Dias_Laborados=case when HorasNoLab > 8 then  ROUND((Dias_Laborados-(Dias_No_Laborados+DiaSubtransc)),2) else ROUND((Dias_Laborados-(DiaSubtransc)),2) end 
--UPDATE @sobreifin SET Dias_Laborados= case when Dias_Laborados<canDiasProd and Dias_No_Laborados=0 then canDiasProd else DiasTrab END  
UPDATE @sobreifin SET Dias_Laborados= case when Dias_Laborados<canDiasProd and Dias_No_Laborados=0 then canDiasProd else Dias_Laborados END  
from @sobreifin t join @ProducDet p on t.COD_EMPLEADO=p.cod_empleado 

UPDATE @sobreifin SET Dias_Laborados=CASE WHEN Dias_Laborados<0 THEN 0 ELSE Dias_Laborados END 
UPDATE @sobreifin SET HorasNoLab=CASE WHEN HorasNoLab<1 THEN 0 ELSE HorasNoLab END 
SELECT * FROM @sobreifin --WHERE cod_Empleado<>7416 --WHERE Dias_Laborados<0 
 --WHERE cod_empleado=7416
--WHERE cod_Empleado=7370
--SELECT Dias_Laborados-(Dias_No_Laborados+DiaSubtransc),Dias_Laborados FROM @sobreifin WHERE cod_Empleado=108
--WHERE cod_Empleado=5480
--{SobreDevDedDet.Dias_Laborados}-({SobreDevDedDet.Dias_No_Laborados}+{SobreDevDedDet.DiaSubtransc})
--SELECT Cod_empleado,SUM(DiaSubtransc) as DiaSubtransc FROM @tmpsub GROUP by cod_empleado
--SELECT * FROM @tmpsub WHERE cod_empleado=6101 --GROUP by cod_empleado 	 
--select * from @devtab  order by cod_dependencia,cod_empleado,fila 
/*select tdev.cod_empleado,isnull(tdev.valor,0) as valdeve,fila,NRO,isnull(rotDeveng,' ') as rotDeveng,
isnull(Valoded,0) as valded,isnull(RotDeduc,' ') as RotDeduc,isnull(saldo,0) as SaldoDeduc,
nom_empleado,ape_empleado,des_cargo,cedula,numero_inss,deve_Deduc,cod_dependencia,des_dependencia,isnull(cant_hextras,0) AS cantExtra
from  @devtab tdev LEFT JOIN @extra p ON tdev.cod_empleado=p.cod_empleado order by cod_dependencia,cod_empleado, fila 
*/
--INTO #AnDev 
--
--SELECT 
--	#AnDev.*
--	,DiasAPagar = CASE WHEN DiasAPagar < 0 OR DiasAPagar IS NULL THEN DiasAPagar ELSE 0 END
--FROM #AnDev 
--LEFT JOIN dbo.MovPVacSem ON #AnDev.cod_empleado = MovPVacSem.cod_empleado 
--ORDER BY 
--	cod_dependencia
--	, cod_empleado,fila
--	
--	select * from dbo.MovPVacSem


--EXEC SobreDevDedDet @_cCod_nomina =  1, @_ConsecPlani= 89, @tabDeven= 'mov_devengados', @tabdeducc='mov_deducciones', @tabhextra='Horas_Extras', @HorasNoLab='Mov_HoraNoLaborada', @Subsdio='Subsidio' 
