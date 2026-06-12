<?php
require_once 'config.php';
$conn = connect();
$res = pg_query($conn, "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'acv_veiculo'");
while($r = pg_fetch_assoc($res)) {
    echo $r['column_name'] . " - " . $r['data_type'] . "\n";
}
